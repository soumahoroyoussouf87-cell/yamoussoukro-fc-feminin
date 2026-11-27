/** Évaluation de séance : critères notés de 1 à 5 ; un critère non observé (null) est exclu du calcul. */
export type Criterion = { label: string; score: number | null };

export const DEFAULT_CRITERIA = ["Atteinte des objectifs", "Intensité de travail", "Engagement du groupe", "Qualité d'exécution", "Respect des consignes"];

export const APPRECIATION_LABELS: Record<string, string> = {
  insuffisant: "Insuffisant", passable: "Passable", satisfaisant: "Satisfaisant", tres_satisfaisant: "Très satisfaisant", excellent: "Excellent",
};

export function scoreCriteria(criteria: Criterion[]) {
  const observed = criteria.filter((c) => typeof c.score === "number" && c.score >= 1 && c.score <= 5) as { label: string; score: number }[];
  if (!observed.length) return null;
  const points = observed.reduce((a, c) => a + c.score, 0);
  const max = observed.length * 5;
  return { points, max, pct: Math.round((points / max) * 100), average: Math.round((points / observed.length) * 10) / 10, observed: observed.length, excluded: criteria.length - observed.length };
}

/** Appréciation proposée à partir du pourcentage (le staff peut la modifier). */
export function suggestAppreciation(pct: number) {
  return pct >= 90 ? "excellent" : pct >= 75 ? "tres_satisfaisant" : pct >= 60 ? "satisfaisant" : pct >= 45 ? "passable" : "insuffisant";
}

export function parseCriteria(raw: unknown): Criterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is { label: unknown; score: unknown } => !!c && typeof c === "object")
    .map((c) => ({ label: String(c.label ?? "").slice(0, 80), score: typeof c.score === "number" ? c.score : null }))
    .filter((c) => c.label.trim());
}
