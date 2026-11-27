import { describe, expect, it } from "vitest";
import {
  aggregatePlayer, developmentIndex, fmtDelta, testResultIndex, testTechniqueIndex, type Observation, type TestPoint, type VersionModel,
} from "@/lib/performance/engine";

const V: VersionModel = {
  id: "v1", versionNo: 1, label: "V1",
  criteria: [
    { id: "t1", code: "passe", label: "Passe", dimension: "technique", defaultWeight: null, sortOrder: 1 },
    { id: "t2", code: "duel", label: "Duel", dimension: "technique", defaultWeight: null, sortOrder: 2 },
    { id: "t3", code: "plongeon", label: "Plongeon", dimension: "technique", defaultWeight: null, sortOrder: 3 },
    { id: "a1", code: "placement", label: "Placement", dimension: "tactique", defaultWeight: 1, sortOrder: 4 },
  ],
  criterionWeights: { t1: { DC: 60 }, t2: { DC: 40 }, t3: { GB: 100 } },
  dimensionWeights: { DC: { technique: 50, tactique: 50 } },
};

const obs = (id: string, date: string, context: Observation["context"], t1: number, a1: number): Observation => ({
  id, date, context, versionId: "v1", frameworkKey: "DC", scores: [{ criterionId: "t1", score: t1 }, { criterionId: "a1", score: a1 }],
});

describe("Indice d'un résultat de test", () => {
  it("réussites ÷ tentatives × 100", () => {
    expect(testResultIndex({ measure: "reussite", attempts: 10, successes: 7 })).toBe(70);
    expect(testResultIndex({ measure: "reussite", attempts: 3, successes: 2 })).toBe(66.7);
    expect(testResultIndex({ measure: "reussite", attempts: 10, successes: 11 })).toBeNull();
    expect(testResultIndex({ measure: "reussite", attempts: null, successes: 5 })).toBeNull();
  });

  it("temps : linéaire entre le temps de référence (100) et le temps limite (0), borné", () => {
    const t = (v: number) => testResultIndex({ measure: "temps", valueSeconds: v, refBest: 5, refLimit: 9 });
    expect(t(5)).toBe(100);
    expect(t(7)).toBe(50);
    expect(t(4)).toBe(100);
    expect(t(12)).toBe(0);
    // Sans barème : pas d'indice (jamais une valeur inventée).
    expect(testResultIndex({ measure: "temps", valueSeconds: 6 })).toBeNull();
  });
});

describe("Source Tests de la note technique", () => {
  it("pondère les critères mesurés avec les poids du poste, ignore le reste", () => {
    // passe 80 (poids 60), duel 50 (poids 40) → 68 ; plongeon non applicable au DC.
    expect(testTechniqueIndex(V, "DC", [
      { criterionCodes: ["passe"], index: 80 }, { criterionCodes: ["duel", "plongeon"], index: 50 }, { criterionCodes: ["passe"], index: null },
    ])).toBe(68);
    expect(testTechniqueIndex(V, "DC", [{ criterionCodes: ["plongeon"], index: 90 }])).toBeNull();
  });

  it("entre à 20 % dans la technique, renormalisé sur les sources présentes", () => {
    const x = aggregatePlayer([obs("e1", "2026-10-01", "match", 3, 3)], new Map([["v1", V]]), V, 1, {
      tests: [{ id: "s1", date: "2026-10-02", results: [{ criterionCodes: ["passe", "duel"], index: 100 }] }],
    });
    // Match : 60 (50 %), tests : 100 (20 %) → (60×50 + 100×20) / 70 = 71,4
    expect(x.dims.technique.index).toBe(71.4);
    expect(x.technicalSources.map((s) => [s.context, s.effectiveWeight])).toEqual([["test", 28.6], ["match", 71.4]]);
    expect(x.testSessions).toBe(1);
    expect(x.observations).toBe(1);
  });

  it("utilise le poste principal quand aucune évaluation n'existe", () => {
    const x = aggregatePlayer([], new Map([["v1", V]]), V, 3, {
      tests: [{ id: "s1", date: "2026-10-02", results: [{ criterionCodes: ["passe"], index: 70 }] }], fallbackKey: "DC",
    });
    expect(x.dims.technique.index).toBe(70);
    expect(x.ipiStatus).toBe("insuffisant");
    expect(x.ipi).toBeNull();
  });
});

describe("IDI : uniquement des mesures comparables", () => {
  const pt = (date: string, version: number, index: number | null, raw: number | null = index, measure: TestPoint["measure"] = "reussite", id = "p1"): TestPoint => ({
    protocolId: id, protocolName: id === "p1" ? "Passe courte" : "Slalom", protocolVersion: version, measure, date, index, raw,
  });

  it("compare première et dernière mesure d'une même version de protocole", () => {
    const d = developmentIndex({ tests: [pt("2026-09-01", 1, 50), pt("2026-10-01", 1, 60), pt("2026-11-01", 1, 70), pt("2026-11-10", 2, 20)], timeline: [] });
    expect(d.comparisons).toHaveLength(1);
    expect(d.comparisons[0]).toMatchObject({ delta: 20, relative: 40, n: 3 });
    expect(d.idi).toBe(20);
  });

  it("ne mélange pas deux versions d'un protocole", () => {
    const d = developmentIndex({ tests: [pt("2026-09-01", 1, 50), pt("2026-10-01", 2, 90)], timeline: [] });
    expect(d.idi).toBeNull();
    expect(d.comparisons).toHaveLength(0);
  });

  it("garde les temps sans barème hors IDI mais donne l'écart en secondes", () => {
    const d = developmentIndex({ tests: [pt("2026-09-01", 1, null, 8.4, "temps", "p2"), pt("2026-10-01", 1, null, 7.9, "temps", "p2")], timeline: [] });
    expect(d.idi).toBeNull();
    expect(d.rawOnly[0].rawDelta).toBe(-0.5);
  });

  it("évaluations : même référentiel, même poste, même contexte", () => {
    const tl = [
      { date: "2026-09-01", context: "match" as const, versionId: "v1", frameworkKey: "DC" as const, ipi: 60 },
      { date: "2026-10-01", context: "entrainement" as const, versionId: "v1", frameworkKey: "DC" as const, ipi: 90 },
      { date: "2026-11-01", context: "match" as const, versionId: "v1", frameworkKey: "DC" as const, ipi: 66 },
      { date: "2026-11-05", context: "match" as const, versionId: "v1", frameworkKey: "N6" as const, ipi: 40 },
    ];
    const d = developmentIndex({ tests: [pt("2026-09-01", 1, 50), pt("2026-10-01", 1, 40)], timeline: tl, versionNo: () => 1 });
    expect(d.comparisons.map((c) => [c.kind, c.delta, c.relative])).toEqual([["evaluation", 6, 10], ["test", -10, -20]]);
    expect(d.idi).toBe(-2);
    expect(d.relative).toBe(-5);
    expect(d.comparisons[0].label).toContain("référentiel v1");
  });

  it("affiche les évolutions avec leur signe", () => {
    expect(fmtDelta(4.5)).toBe("+4,5 pts");
    expect(fmtDelta(-2)).toBe("−2 pts");
    expect(fmtDelta(0)).toBe("0 pt");
    expect(fmtDelta(-0.5, "s")).toBe("−0,5 s");
  });
});
