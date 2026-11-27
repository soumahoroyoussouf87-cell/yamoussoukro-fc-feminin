export type ImportPlayer = { id: string; name: string; shirt: number | null; hasPhoto: boolean };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Associe un fichier « 16. AMINATA SANOGO - Gardienne.jpg » à une joueuse : numéro d'abord, puis nom. */
export function matchPlayer(fileName: string, players: ImportPlayer[]): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  const num = base.match(/^\s*(\d{1,2})\s*[.\-_)]/);
  if (num) {
    const p = players.find((x) => x.shirt === Number(num[1]));
    if (p) return p.id;
  }
  const words = new Set(norm(base.replace(/^\s*\d+\s*[.\-_)]\s*/, "").split(" - ")[0]).split(" "));
  let best = { id: "", score: 0 };
  for (const p of players) {
    const parts = norm(p.name).split(" ").filter((w) => w.length > 1);
    const hit = parts.filter((w) => words.has(w)).length;
    if (hit === parts.length && hit > best.score) best = { id: p.id, score: hit };
  }
  return best.id;
}
