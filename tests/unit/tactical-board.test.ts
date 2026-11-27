import { describe, expect, it } from "vitest";
import { buildShapes, diagramSvg, emptyDiagram, parseDiagram } from "@/lib/training/diagram";
import { shortName } from "@/lib/tactics/roster";

describe("Tableau tactique : nom des joueuses sur les pions", () => {
  const d = emptyDiagram("third");
  d.items.push({ id: "p1", type: "player", x: 100, y: 100, team: "a", label: "9", name: "A. KONÉ", pid: "6f1c1f9e-2b7a-4c1e-9a43-0d5c8f2a1b11" });
  d.items.push({ id: "p2", type: "player", x: 200, y: 100, team: "b", label: "4" });

  it("le nom est accepté et conservé par la validation", () => {
    const p = parseDiagram(JSON.parse(JSON.stringify(d)));
    expect(p?.items[0]).toMatchObject({ name: "A. KONÉ", label: "9" });
    expect(p?.items[1]).not.toHaveProperty("name");
  });

  it("le nom est dessiné sous le pion (et dans les exports SVG/PNG)", () => {
    const texts = buildShapes(d).filter((s) => s.k === "text").map((s) => (s as { text: string }).text);
    expect(texts).toContain("A. KONÉ");
    expect(diagramSvg(d)).toContain("A. KONÉ");
  });

  it("un nom trop long est refusé", () => {
    const bad = JSON.parse(JSON.stringify(d));
    bad.items[0].name = "X".repeat(30);
    expect(parseDiagram(bad)).toBeNull();
  });

  it("nom court : initiale du prénom + nom en capitales", () => {
    expect(shortName(" awa ", "koné")).toBe("A. KONÉ");
  });
});
