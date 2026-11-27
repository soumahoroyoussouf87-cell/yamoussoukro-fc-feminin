import { describe, expect, it } from "vitest";
import { clockAt, computeSchedule, itemDuration, plannedMinutes } from "@/lib/training/schedule";
import { parseCriteria, scoreCriteria, suggestAppreciation } from "@/lib/training/evaluation";
import { plannedLoad, teamLoad } from "@/lib/training/load";
import { buildShapes, countEquipment, emptyDiagram, parseDiagram, posAt, posBetween, shapesToSvg, pitchSize } from "@/lib/training/diagram";
import { progress, sheetChecks } from "@/lib/training/completeness";
import type { SheetData } from "@/lib/training/sheet-types";

const item = (id: string, d: number | null, series: number | null = null, rec: number | null = null, pause: number | null = null) =>
  ({ id, duration_min: d, series, recovery_sec: rec, pause_after_min: pause });

describe("déroulé de séance", () => {
  it("durée d'un exercice = séries × durée + récupérations entre séries + pause", () => {
    expect(itemDuration(item("a", 4, 3, 60, 2))).toEqual({ work: 12, recovery: 2, pause: 2, total: 16 });
    expect(itemDuration(item("b", 12))).toEqual({ work: 12, recovery: 0, pause: 0, total: 12 });
  });
  it("enchaîne les phases et les horaires", () => {
    const s = computeSchedule([
      { id: "p1", duration_min: null, items: [item("a", 12)] },
      { id: "p2", duration_min: 5, items: [] },
      { id: "p3", duration_min: null, items: [item("b", 15, 2, 120), item("c", 4, 3, 60, 2)] },
    ]);
    expect(s.total).toBe(12 + 5 + 32 + 16);
    expect(s.phases[2].items[1].start).toBe(49);
    expect(s.phases[2].items[1].end).toBe(63); // la pause suit l'exercice
    expect(clockAt("16:30:00", s.phases[2].start)).toBe("16h47");
    expect(clockAt("23:50", 20)).toBe("00h10");
  });
  it("durée prévue par les horaires", () => {
    expect(plannedMinutes("16:30:00", "18:00:00")).toBe(90);
    expect(plannedMinutes("18:00", "16:00")).toBeNull();
    expect(plannedMinutes(null, "18:00")).toBeNull();
  });
});

describe("évaluation par critères", () => {
  it("exclut les critères non observés", () => {
    const r = scoreCriteria([{ label: "A", score: 4 }, { label: "B", score: 5 }, { label: "C", score: null }]);
    expect(r).toMatchObject({ points: 9, max: 10, pct: 90, observed: 2, excluded: 1 });
    expect(scoreCriteria([{ label: "A", score: null }])).toBeNull();
  });
  it("propose une appréciation", () => {
    expect(suggestAppreciation(90)).toBe("excellent");
    expect(suggestAppreciation(60)).toBe("satisfaisant");
    expect(suggestAppreciation(10)).toBe("insuffisant");
  });
  it("lit des critères stockés en JSON de façon défensive", () => {
    expect(parseCriteria([{ label: "Engagement", score: 4 }, { label: "", score: 3 }, null, "x"])).toEqual([{ label: "Engagement", score: 4 }]);
    expect(parseCriteria("nope")).toEqual([]);
  });
});

describe("charge sRPE", () => {
  it("moyennes équipe sur les joueuses notées uniquement", () => {
    const r = teamLoad([{ minutes: 60, rpe: 6 }, { minutes: 60, rpe: 8 }, { minutes: 60, rpe: null }, { minutes: 0, rpe: 5 }]);
    expect(r).toEqual({ players: 2, rpe: 7, minutes: 60, srpe: 420, total: 840 });
    expect(teamLoad([])).toBeNull();
  });
  it("charge prévue", () => {
    expect(plannedLoad(6, 60)).toBe(360);
    expect(plannedLoad(null, 60)).toBeNull();
  });
});

describe("schéma tactique", () => {
  const d = emptyDiagram("half");
  d.items.push(
    { id: "p1", type: "player", x: 100, y: 100, team: "a", label: "1" },
    { id: "b", type: "ball", x: 110, y: 110 },
    { id: "c1", type: "cone", x: 10, y: 10 },
    { id: "c2", type: "cone", x: 20, y: 10 },
    { id: "ar", type: "arrow", kind: "pass", from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
    { id: "z", type: "zone", shape: "rect", x: 0, y: 0, w: 100, h: 50, color: "#facc15", hatch: true, label: "Zone 1" },
  );
  d.frames.push({ id: "f2", pos: { p1: { x: 200, y: 100 } } });

  it("anime les positions entre les étapes", () => {
    const p = d.items[0] as never;
    expect(posAt(d, p, 0)).toEqual({ x: 100, y: 100 });
    expect(posAt(d, p, 1)).toEqual({ x: 200, y: 100 });
    expect(posBetween(d, p, 0, 0.5)).toEqual({ x: 150, y: 100 });
  });
  it("valide les données importées et refuse un schéma corrompu", () => {
    expect(parseDiagram(JSON.parse(JSON.stringify(d)))).not.toBeNull();
    expect(parseDiagram({ ...d, items: [{ id: "x", type: "player", x: 1, y: 1, team: "z", label: "1" }] })).toBeNull();
    expect(parseDiagram({ v: 2 })).toBeNull();
  });
  it("produit un SVG autonome et échappe le texte", () => {
    const withText = { ...d, items: [...d.items, { id: "t", type: "text" as const, x: 5, y: 5, text: "<script>", size: 20, color: "#ffffff" }] };
    const { w, h } = pitchSize("half");
    const svg = shapesToSvg(buildShapes(withText), w, h);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
  });
  it("compte le matériel du schéma", () => {
    expect(countEquipment(d)).toEqual({ player: 1, ball: 1, cone: 2 });
  });
});

describe("complétude de la fiche", () => {
  const base: SheetData = {
    club: { name: "YFC", season: "2026-2027" },
    session: {
      id: "s", number: 1, status: "brouillon", session_date: "2026-12-01", starts_at: "16:30:00", ends_at: "18:00:00", location: "Stade", period: null, game_system: null,
      audience: null, responsible_staff_id: null, responsible: null, weather: null, pitch_condition: null, theme: "Pressing", sub_theme: null, theme_id: "t", sub_theme_id: null,
      main_objective: "Objectif", secondary_objectives: null, specific_objectives: [], intensity: null, planned_rpe: null, notes: null, legacy_equipment: null, video_links: [],
      wizard_step: 1, validated_at: null, validated_by_name: null, published_at: null, updated_at: "", match_ref: null,
    },
    phases: [], equipment: [], players: [], attendance: [], evaluation: null, diagrams: {},
  };
  it("bloque tant qu'il n'y a pas d'exercice", () => {
    const p = progress(sheetChecks(base, "2026-11-27"));
    expect(p.missingRequired.map((c) => c.step)).toContain(3);
    // séance future : présences et évaluation pas encore obligatoires
    expect(p.missingRequired.some((c) => c.step === 5 || c.step === 7)).toBe(false);
  });
  it("exige présences et évaluation une fois la séance passée", () => {
    const p = progress(sheetChecks(base, "2026-12-02"));
    expect(p.missingRequired.map((c) => c.step)).toEqual(expect.arrayContaining([5, 7]));
  });
});
