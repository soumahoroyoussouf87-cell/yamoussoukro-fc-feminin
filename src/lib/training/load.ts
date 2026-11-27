/** Charge d'entraînement (méthode sRPE de Foster) : minutes de participation × RPE (0-10) = unités arbitraires (UA). */
export type LoadRow = { minutes: number | null; rpe: number | null; srpe?: number | null };

export function teamLoad(rows: LoadRow[]) {
  const rated = rows.filter((r) => r.rpe != null && r.minutes != null && r.minutes > 0);
  if (!rated.length) return null;
  const srpe = rated.map((r) => r.srpe ?? (r.minutes as number) * (r.rpe as number));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    players: rated.length,
    rpe: Math.round(avg(rated.map((r) => r.rpe as number)) * 10) / 10,
    minutes: Math.round(avg(rated.map((r) => r.minutes as number))),
    srpe: Math.round(avg(srpe)),
    total: srpe.reduce((x, y) => x + y, 0),
  };
}

/** Charge prévue : RPE prévu × durée programmée. */
export const plannedLoad = (plannedRpe: number | null | undefined, minutes: number | null | undefined) =>
  plannedRpe && minutes ? Math.round(plannedRpe * minutes) : null;

export const PARTICIPATION_LABELS: Record<string, string> = { complete: "Complète", adaptee: "Adaptée", partielle: "Partielle", aucune: "Aucune" };
