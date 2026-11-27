import { describe, expect, it } from "vitest";
import { POSTER_FORMATS, posterGrid } from "@/lib/phase2/poster-layout";

describe("affiche des convoquées : grille", () => {
  const area = (f: keyof typeof POSTER_FORMATS) => {
    const p = POSTER_FORMATS[f];
    return [p.width - 64, p.height - p.header - p.footer - 32] as const;
  };
  it("18 joueuses en portrait : 6 colonnes, 3 rangées complètes", () => {
    const g = posterGrid(18, ...area("portrait"));
    expect(g.cols).toBe(6);
    expect(g.rows).toEqual([6, 6, 6]);
  });
  it("chaque joueuse a sa carte et la grille tient dans la zone", () => {
    for (const f of Object.keys(POSTER_FORMATS) as (keyof typeof POSTER_FORMATS)[]) {
      const [w, h] = area(f);
      for (let n = 1; n <= 25; n++) {
        const g = posterGrid(n, w, h);
        expect(g.rows.reduce((a, b) => a + b, 0)).toBe(n);
        expect(g.cols * g.cardWidth + (g.cols - 1) * 12).toBeLessThanOrEqual(w);
        expect(g.rows.length * g.cardHeight + (g.rows.length - 1) * 12).toBeLessThanOrEqual(h + 1);
        expect(g.cardWidth).toBeGreaterThan(60);
      }
    }
  });
  it("dernière rangée incomplète en dernier (centrée à l'affichage)", () => {
    const g = posterGrid(23, ...area("portrait"));
    expect(g.rows[g.rows.length - 1]).toBeLessThanOrEqual(g.cols);
    expect(g.rows.slice(0, -1).every((r) => r === g.cols)).toBe(true);
  });
});
