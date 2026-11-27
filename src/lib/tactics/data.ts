import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { profileNames } from "@/lib/performance/data";

export type H2H = { id: string; date: string; status: string; home_away: string; goals_for: number | null; goals_against: number | null; matchday: string | null };

export const resultOf = (m: { status: string; goals_for: number | null; goals_against: number | null }) =>
  m.status !== "joue" || m.goals_for == null || m.goals_against == null ? null : m.goals_for > m.goals_against ? "V" : m.goals_for < m.goals_against ? "D" : "N";

/** Fiche adversaire : confrontations et observations (confidentiel, RLS evaluations.read). */
export async function loadOpponent(ctx: AccessContext, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const [{ data: o }, { data: matches }, { data: notes }] = await Promise.all([
    supabase.from("opponents").select("id, name, city, logo_path").eq("id", id).eq("club_id", ctx.clubId).maybeSingle(),
    supabase.from("matches").select("id, kickoff_at, status, home_away, goals_for, goals_against, matchday").eq("club_id", ctx.clubId).eq("opponent_id", id).order("kickoff_at"),
    supabase.from("opponent_scouting").select("*").eq("club_id", ctx.clubId).eq("opponent_id", id).order("observed_on", { ascending: false }),
  ]);
  if (!o) return null;
  const h2h: H2H[] = (matches ?? []).map((m) => ({ id: m.id, date: m.kickoff_at.slice(0, 10), status: m.status, home_away: m.home_away, goals_for: m.goals_for, goals_against: m.goals_against, matchday: m.matchday }));
  const names = await profileNames((notes ?? []).map((n) => n.created_by));
  const byMatch = new Map(h2h.map((m) => [m.id, m]));
  const scouting = (notes ?? []).map((n) => {
    const m = n.match_id ? byMatch.get(n.match_id) : null;
    return { ...n, author: n.created_by ? names.get(n.created_by) ?? null : null, match_label: m ? `Match du ${m.date.split("-").reverse().join("/")}${m.matchday ? ` (${m.matchday})` : ""}` : null };
  });
  return { opponent: o, h2h, scouting };
}
