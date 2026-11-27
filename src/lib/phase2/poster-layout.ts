/** Formats de l'affiche des convoquées (pixels, rendu 1x ; les exports HD sont en 2x). */
export const POSTER_FORMATS = {
  portrait: { label: "Portrait 4:5 (publication)", width: 1080, height: 1350, header: 300, footer: 64 },
  carre: { label: "Carré 1:1", width: 1080, height: 1080, header: 250, footer: 56 },
  story: { label: "Story 9:16 (statut WhatsApp)", width: 1080, height: 1920, header: 420, footer: 90 },
} as const;
export type PosterFormat = keyof typeof POSTER_FORMATS;

export type PosterGrid = { cols: number; cardWidth: number; cardHeight: number; rows: number[] };

/**
 * Grille de cartes la plus grande possible dans la zone donnée.
 * À surface presque égale (8 %), on préfère des rangées complètes (comme 6 × 3 pour 18 joueuses).
 * La dernière rangée, si elle est incomplète, est centrée par l'affichage.
 */
export function posterGrid(count: number, width: number, height: number, opts: { gap?: number; ratio?: number; maxRatio?: number; maxCols?: number } = {}): PosterGrid {
  const gap = opts.gap ?? 12;
  const ratio = opts.ratio ?? 1.3; // hauteur / largeur minimale d'une carte
  const maxRatio = opts.maxRatio ?? 1.8; // les cartes s'allongent pour occuper la hauteur disponible
  const n = Math.max(1, count);
  let best: { cols: number; w: number; a: number; empty: number } | null = null;
  for (let cols = 1; cols <= Math.min(n, opts.maxCols ?? 8); cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((width - (cols - 1) * gap) / cols, (height - (rows - 1) * gap) / rows / ratio);
    // On compare la surface des cartes (largeur × hauteur réellement disponible).
    const a = w * Math.min(w * maxRatio, (height - (rows - 1) * gap) / rows);
    const empty = rows * cols - n;
    if (!best || a > best.a * 1.08 || (a > best.a * 0.92 && empty < best.empty) || (a > best.a && empty <= best.empty)) best = { cols, w, a, empty };
  }
  const cols = best!.cols;
  const cardWidth = Math.floor(best!.w);
  const rows: number[] = [];
  for (let left = n; left > 0; left -= cols) rows.push(Math.min(cols, left));
  const rowHeight = (height - (rows.length - 1) * gap) / Math.max(1, rows.length);
  return { cols, cardWidth, cardHeight: Math.floor(Math.min(cardWidth * maxRatio, rowHeight)), rows: count ? rows : [] };
}
