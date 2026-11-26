/**
 * Références J-x du microcycle : J = jour de match, J-6 … J-1 avant le match
 * suivant, J+1 (et J+2) après un match. Les semaines à plusieurs rencontres sont
 * gérées : un jour peut porter deux références (ex. « J+1 / J-2 »).
 * Dates ISO « AAAA-MM-JJ » uniquement (pas de fuseau horaire).
 */
const DAY = 86_400_000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function dayDiff(from: string, to: string) {
  return Math.round((toTime(to) - toTime(from)) / DAY);
}

export function addDays(iso: string, days: number) {
  return new Date(toTime(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Lundi de la semaine ISO contenant `iso`. */
export function mondayOf(iso: string) {
  const d = new Date(toTime(iso));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(iso, -dow);
}

export function weekDays(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * @param day jour à qualifier
 * @param matchDates dates des rencontres (toutes compétitions)
 * @param horizon nombre de jours avant un match pris en compte (6 → J-6)
 */
export function matchDayLabel(day: string, matchDates: string[], horizon = 6): string | null {
  const diffs = [...new Set(matchDates)].map((m) => dayDiff(day, m));
  if (diffs.includes(0)) return "J";
  const before = diffs.filter((d) => d > 0 && d <= horizon).sort((a, b) => a - b)[0];
  const after = diffs.filter((d) => d < 0 && d >= -2).sort((a, b) => b - a)[0];
  const parts: string[] = [];
  if (after !== undefined) parts.push(`J+${-after}`);
  if (before !== undefined) parts.push(`J-${before}`);
  // J+2 n'est affiché que s'il n'y a pas de match proche à préparer.
  if (after === -2 && before !== undefined) parts.shift();
  return parts.length ? parts.join(" / ") : null;
}
