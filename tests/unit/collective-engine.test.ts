import { describe, expect, it } from "vitest";
import { aggregateTeam, evaluateCollective, teamDevelopment, type CollectiveObservation, type GameVersionModel } from "@/lib/performance/collective";

const V: GameVersionModel = {
  id: "g1", versionNo: 1, label: "V1",
  moments: [
    { id: "m1", code: "organisation_offensive", label: "OO", weight: 25 },
    { id: "m2", code: "organisation_defensive", label: "OD", weight: 30 },
    { id: "m3", code: "transition_offensive", label: "TO", weight: 15 },
    { id: "m4", code: "transition_defensive", label: "TD", weight: 20 },
    { id: "m5", code: "cpa", label: "CPA", weight: 10 },
  ],
  principles: [
    { id: "p1", code: "oo_largeur", label: "Largeur", moment: "organisation_offensive" },
    { id: "p2", code: "oo_profondeur", label: "Profondeur", moment: "organisation_offensive" },
    { id: "p3", code: "od_compacite", label: "Compacité", moment: "organisation_defensive" },
    { id: "p4", code: "td_repli", label: "Repli", moment: "transition_defensive" },
  ],
};
const P = (unit: string, score: number | null) => ({ kind: "principe" as const, unit, criterion: "maitrise", score });
const o = (id: string, date: string, scores: CollectiveObservation["scores"], context: CollectiveObservation["context"] = "match", measures: CollectiveObservation["measures"] = []): CollectiveObservation =>
  ({ id, date, context, versionId: "g1", scores, measures });

describe("Évaluation collective", () => {
  it("IPC : moyenne des principes par moment, moments pondérés et renormalisés, N/E exclu", () => {
    const e = evaluateCollective(V, { scores: [P("oo_largeur", 4), P("oo_profondeur", 2), P("od_compacite", 5), P("td_repli", null)], measures: [] });
    expect(e.moments.organisation_offensive).toEqual({ index: 60, evaluated: 2, total: 2 });
    expect(e.moments.transition_defensive.index).toBeNull();
    // (60×25 + 100×30) / 55 = 81,8
    expect(e.ipc).toBe(81.8);
  });

  it("secteurs, relations et compacité", () => {
    const e = evaluateCollective(V, {
      scores: [
        { kind: "secteur", unit: "defense", criterion: "coordination", score: 4 }, { kind: "secteur", unit: "defense", criterion: "communication", score: 2 },
        { kind: "secteur", unit: "milieu", criterion: "equilibre", score: 5 }, { kind: "relation", unit: "defense_milieu", criterion: "distances", score: 3 },
      ],
      measures: [
        { relation: "defense_milieu", situation: "bloc_median", distance: 13, targetMin: 10, targetMax: 15 },
        { relation: "milieu_attaque", situation: "bloc_median", distance: 19, targetMin: 10, targetMax: 15 },
        { relation: "defense_milieu", situation: "possession", distance: 25, targetMin: null, targetMax: null },
      ],
    });
    expect(e.sectors.defense.index).toBe(60);
    expect(e.ips).toBe(80);
    expect(e.ipr).toBe(60);
    // Sans objectif pour la situation : mesure conservée mais non jugée.
    expect(e.compactness).toEqual({ measured: 3, checked: 2, inTarget: 1 });
  });
});

describe("Indices d'équipe", () => {
  const list = [
    o("e1", "2026-09-01", [P("oo_largeur", 2), P("od_compacite", 3)]),
    o("e2", "2026-10-01", [P("oo_largeur", 4), P("od_compacite", 3), P("td_repli", 2)]),
    o("e3", "2026-11-01", [P("oo_largeur", 5), P("od_compacite", 4)], "entrainement"),
  ];

  it("seuil d'observations avant publication", () => {
    const t = aggregateTeam(list.slice(0, 2), new Map([["g1", V]]), V, 3);
    expect(t.ipc).toBeNull();
    expect(t.raw.ipc).not.toBeNull();
    expect(t.enough).toBe(false);
  });

  it("IMP : part des principes maîtrisés (≥ 60) par moment, pondérée", () => {
    const t = aggregateTeam(list, new Map([["g1", V]]), V, 3);
    // largeur (40,80,100) → 73,3 maîtrisé ; compacité (60,60,80) → 66,7 maîtrisé ; repli 40 non maîtrisé ; profondeur non évaluée.
    expect(t.mastery).toMatchObject({ organisation_offensive: 100, organisation_defensive: 100, transition_defensive: 0 });
    // (100×25 + 100×30 + 0×20) / 75 = 73,3
    expect(t.imp).toBe(73.3);
    expect(t.evaluatedPrinciples).toBe(3);
    expect(t.totalPrinciples).toBe(4);
  });

  it("IDC : même version et même contexte seulement", () => {
    const t = aggregateTeam(list, new Map([["g1", V]]), V, 1);
    const d = teamDevelopment(t.timeline, () => 1);
    // Compétition : e1 IPC (40×25+60×30)/55 = 50,9 ; e2 (80×25+60×30+40×20)/75 = 61,3 → +10,4. L'entraînement n'a qu'une mesure.
    expect(d.comparisons.map((c) => [c.label, c.delta])).toEqual([["IPC en compétition (projet de jeu v1)", 10.4]]);
    expect(d.idc).toBe(10.4);
    expect(d.ids).toBeNull();
  });
});

