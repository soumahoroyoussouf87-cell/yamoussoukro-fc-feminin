/**
 * Statistiques individuelles calculées UNIQUEMENT à partir des données saisies :
 * composition officielle (validée ou communiquée) et événements de match.
 * Aucune valeur n'est estimée : sans composition officielle, le match n'est pas compté.
 */
export type OfficialLineup = { match_id: string; duration: number; starters: string[]; substitutes: string[] };
export type MatchEvent = { match_id: string; type: string; minute: number; player_id: string | null; related_player_id: string | null };

export type PlayerLine = {
  played: number;
  starts: number;
  subAppearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

const empty = (): PlayerLine => ({ played: 0, starts: 0, subAppearances: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 });

export function computePlayerStats(lineups: OfficialLineup[], events: MatchEvent[]): Map<string, PlayerLine> {
  const out = new Map<string, PlayerLine>();
  const line = (id: string) => {
    if (!out.has(id)) out.set(id, empty());
    return out.get(id)!;
  };
  for (const l of lineups) {
    const evs = events.filter((e) => e.match_id === l.match_id);
    const subs = evs.filter((e) => e.type === "remplacement").sort((a, b) => a.minute - b.minute);
    const reds = evs.filter((e) => e.type === "carton_rouge");
    const entry = new Map<string, number>();
    const exit = new Map<string, number>();
    for (const s of l.starters) entry.set(s, 0);
    for (const s of subs) {
      if (s.player_id && !exit.has(s.player_id)) exit.set(s.player_id, Math.min(s.minute, l.duration));
      if (s.related_player_id && !entry.has(s.related_player_id)) entry.set(s.related_player_id, Math.min(s.minute, l.duration));
    }
    for (const r of reds) if (r.player_id && !exit.has(r.player_id)) exit.set(r.player_id, Math.min(r.minute, l.duration));
    for (const [pid, start] of entry) {
      const p = line(pid);
      p.played++;
      if (start === 0 && l.starters.includes(pid)) p.starts++;
      else p.subAppearances++;
      p.minutes += Math.max(0, (exit.get(pid) ?? l.duration) - start);
    }
  }
  for (const e of events) {
    if (e.type === "but" && e.player_id) line(e.player_id).goals++;
    if (e.type === "but" && e.related_player_id) line(e.related_player_id).assists++;
    if (e.type === "carton_jaune" && e.player_id) line(e.player_id).yellow++;
    if (e.type === "carton_rouge" && e.player_id) line(e.player_id).red++;
  }
  return out;
}

/** Score reconstitué à partir des événements (contrôle de cohérence avec le score saisi). */
export function scoreFromEvents(events: { type: string }[]) {
  let us = 0;
  let them = 0;
  for (const e of events) {
    if (e.type === "but" || e.type === "csc_pour") us++;
    if (e.type === "but_adverse" || e.type === "csc_contre") them++;
  }
  return { us, them };
}
