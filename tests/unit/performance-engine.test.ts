import { describe, expect, it } from "vitest";
import {
  aggregatePlayer, applicableCriteria, combineSources, evaluationDimensions, levelOf, reliabilityOf, scoreToIndex,
  teamDimensionIndices, weightedIndex, type Observation, type VersionModel,
} from "@/lib/performance/engine";

// Référentiel réduit : 3 critères techniques pondérés pour DC, 2 critères tactiques à poids égal.
const V: VersionModel = {
  id: "v1",
  versionNo: 1,
  label: "V1",
  criteria: [
    { id: "t1", code: "passe", label: "Passe", dimension: "technique", defaultWeight: null, sortOrder: 1 },
    { id: "t2", code: "duel", label: "Duel", dimension: "technique", defaultWeight: null, sortOrder: 2 },
    { id: "t3", code: "aerien", label: "Aérien", dimension: "technique", defaultWeight: null, sortOrder: 3 },
    { id: "t4", code: "plongeon", label: "Plongeon", dimension: "technique", defaultWeight: null, sortOrder: 4 },
    { id: "a1", code: "placement", label: "Placement", dimension: "tactique", defaultWeight: 1, sortOrder: 5 },
    { id: "a2", code: "couverture", label: "Couverture", dimension: "tactique", defaultWeight: 1, sortOrder: 6 },
    { id: "m1", code: "concentration", label: "Concentration", dimension: "mentale", defaultWeight: 1, sortOrder: 7 },
  ],
  criterionWeights: { t1: { DC: 50 }, t2: { DC: 30 }, t3: { DC: 20 }, t4: { GB: 100 }, a2: { GB: 0 } },
  dimensionWeights: { DC: { technique: 20, tactique: 35, athletique: 20, cognitive: 15, mentale: 5, comportementale: 5 } },
};

const obs = (id: string, date: string, context: Observation["context"], scores: [string, number | null][]): Observation => ({
  id, date, context, versionId: "v1", frameworkKey: "DC", scores: scores.map(([criterionId, score]) => ({ criterionId, score })),
});

describe("Échelle et applicabilité", () => {
  it("convertit 1-5 sur 100 et ignore N/E", () => {
    expect([1, 2, 3, 4, 5].map(scoreToIndex)).toEqual([20, 40, 60, 80, 100]);
    expect(scoreToIndex(null)).toBeNull();
    expect(scoreToIndex(0)).toBeNull();
    expect(levelOf(60)).toBe("Acquis");
    expect(levelOf(null)).toBe("Non évalué");
  });

  it("n'applique un critère qu'aux postes concernés", () => {
    expect(applicableCriteria(V, "DC", "technique").map((c) => c.code)).toEqual(["passe", "duel", "aerien"]);
    expect(applicableCriteria(V, "GB", "technique").map((c) => c.code)).toEqual(["plongeon"]);
    // Poids explicite à 0 : critère retiré pour ce poste.
    expect(applicableCriteria(V, "GB", "tactique").map((c) => c.code)).toEqual(["placement"]);
  });
});

describe("Formule de l'indice", () => {
  it("pondère les critères évalués : Σ(note × poids) ÷ Σ(poids)", () => {
    const d = evaluationDimensions(V, "DC", [{ criterionId: "t1", score: 5 }, { criterionId: "t2", score: 3 }, { criterionId: "t3", score: 1 }]);
    // (100×50 + 60×30 + 20×20) / 100 = 72
    expect(d.technique.index).toBe(72);
    expect(d.technique.evaluated).toBe(3);
  });

  it("N/E ne pénalise jamais : exclu du numérateur et du dénominateur", () => {
    const d = evaluationDimensions(V, "DC", [{ criterionId: "t1", score: 5 }, { criterionId: "t2", score: null }]);
    expect(d.technique.index).toBe(100);
    expect(d.technique.evaluated).toBe(1);
    expect(d.technique.applicable).toBe(3);
    expect(d.tactique.index).toBeNull();
  });

  it("ignore un critère qui n'est pas celui du poste occupé", () => {
    const d = evaluationDimensions(V, "DC", [{ criterionId: "t4", score: 1 }, { criterionId: "t1", score: 4 }]);
    expect(d.technique.index).toBe(80);
  });

  it("combine les dimensions évaluées avec les pondérations du poste", () => {
    // technique 80 (20 %), tactique 60 (35 %) → (80×20 + 60×35) / 55 = 67,3
    expect(weightedIndex({ technique: 80, tactique: 60, athletique: null }, V.dimensionWeights.DC)).toBe(67.3);
    expect(weightedIndex({}, V.dimensionWeights.DC)).toBeNull();
  });
});

describe("Sources de l'évaluation technique 20/30/50", () => {
  it("pondère les trois sources", () => {
    const r = combineSources({ test: [40], entrainement: [60], match: [80] });
    expect(r.index).toBe(66); // 40×0,2 + 60×0,3 + 80×0,5
    expect(r.renormalized).toBe(false);
  });

  it("renormalise sur les sources présentes", () => {
    const r = combineSources({ entrainement: [60], match: [80] });
    expect(r.index).toBe(72.5); // (60×30 + 80×50) / 80
    expect(r.renormalized).toBe(true);
    expect(r.sources.map((s) => s.effectiveWeight)).toEqual([37.5, 62.5]);
  });

  it("moyenne d'abord à l'intérieur de chaque source", () => {
    expect(combineSources({ match: [60, 100] }).index).toBe(80);
    expect(combineSources({}).index).toBeNull();
  });
});

describe("Seuil de publication et fiabilité", () => {
  const full = (id: string, date: string, context: Observation["context"], s: number) =>
    obs(id, date, context, [["t1", s], ["t2", s], ["t3", s], ["a1", s], ["a2", s], ["m1", s]]);

  it("n'affiche pas d'IPI sous le seuil d'observations", () => {
    const r = aggregatePlayer([full("e1", "2026-11-01", "match", 4), full("e2", "2026-11-08", "match", 4)], new Map([["v1", V]]), V, 3);
    expect(r.observations).toBe(2);
    expect(r.ipi).toBeNull();
    expect(r.ipiStatus).toBe("insuffisant");
    expect(r.reliability).toBe("insuffisante");
    // Les dimensions restent visibles, avec leur nombre d'observations.
    expect(r.dims.technique).toEqual({ index: 80, n: 2 });
  });

  it("publie l'IPI au-delà du seuil et trace la progression", () => {
    const r = aggregatePlayer(
      [full("e3", "2026-11-15", "entrainement", 5), full("e1", "2026-11-01", "match", 3), full("e2", "2026-11-08", "match", 4)],
      new Map([["v1", V]]), V, 3,
    );
    expect(r.ipiStatus).toBe("publie");
    // Technique : match moyenne 70 (50 %), entraînement 100 (30 %) → (70×50 + 100×30)/80 = 81,3
    expect(r.dims.technique.index).toBe(81.3);
    expect(r.dims.tactique.index).toBe(80);
    expect(r.dims.mentale.index).toBe(80);
    expect(r.ipi).toBe(weightedIndex({ technique: 81.3, tactique: 80, mentale: 80 }, V.dimensionWeights.DC));
    expect(r.timeline.map((t) => t.date)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
    expect(r.timeline[0].ipi).toBe(60);
    expect(r.coverage).toBe(1);
    expect(r.reliability).toBe("moyenne"); // 3 observations < 2 × seuil
    expect(r.frameworkKey).toBe("DC");
  });

  it("calcule la fiabilité selon observations et couverture", () => {
    expect(reliabilityOf(2, 1, 3)).toBe("insuffisante");
    expect(reliabilityOf(10, 0.4, 3)).toBe("faible");
    expect(reliabilityOf(4, 1, 3)).toBe("moyenne");
    expect(reliabilityOf(6, 0.8, 3)).toBe("elevee");
  });

  it("ne publie aucun indice sans évaluation", () => {
    const r = aggregatePlayer([], new Map([["v1", V]]), V, 3);
    expect(r.ipiStatus).toBe("non_evalue");
    expect(r.dims.technique.index).toBeNull();
  });

  it("indices d'équipe : seulement les joueuses au-dessus du seuil", () => {
    const a = aggregatePlayer([1, 2, 3].map((i) => full(`a${i}`, `2026-11-0${i}`, "match", 4)), new Map([["v1", V]]), V, 3);
    const b = aggregatePlayer([full("b1", "2026-11-01", "match", 1)], new Map([["v1", V]]), V, 3);
    const t = teamDimensionIndices([a, b], 3);
    expect(t.players).toBe(1);
    expect(t.dims.technique.index).toBe(80);
  });
});
