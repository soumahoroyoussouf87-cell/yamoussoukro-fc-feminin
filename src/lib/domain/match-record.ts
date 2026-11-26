export type MatchLike = { status: string; goals_for: number | null; goals_against: number | null };

export type MatchRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
};

/**
 * Bilan sportif calculé uniquement sur les matchs au statut « joue » dont le
 * score est saisi. Les matchs programmés, reportés ou annulés sont ignorés.
 */
export function computeMatchRecord(matches: MatchLike[]): MatchRecord {
  const r: MatchRecord = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 };
  for (const m of matches) {
    if (m.status !== "joue" || m.goals_for == null || m.goals_against == null) continue;
    r.played++;
    r.goalsFor += m.goals_for;
    r.goalsAgainst += m.goals_against;
    if (m.goals_for > m.goals_against) r.wins++;
    else if (m.goals_for === m.goals_against) r.draws++;
    else r.losses++;
    if (m.goals_against === 0) r.cleanSheets++;
  }
  return r;
}
