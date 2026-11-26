import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getScope, listMatches } from "@/lib/phase2/data";
import { addDays, matchDayLabel, mondayOf, weekDays } from "@/lib/domain/match-day";
import { dayOf, todayIso } from "@/lib/phase2/labels";

/** Widgets du tableau de bord alimentés par les modules de la Phase 2 (données réelles uniquement). */
export async function getPhase2Widgets(ctx: AccessContext) {
  const supabase = await createClient();
  const scope = await getScope(ctx);
  const today = todayIso();
  const monday = mondayOf(today);
  const canPlanning = ctx.permissions.has("planning.read");
  const canMatches = ctx.permissions.has("matches.read");
  const [{ data: next }, { data: sessions }, { data: events }, matches, { data: standings }] = await Promise.all([
    canPlanning ? supabase.from("training_sessions").select("id, number, theme, session_date, starts_at, intensity").eq("club_id", ctx.clubId).gte("session_date", today).order("session_date").order("starts_at").limit(1) : Promise.resolve({ data: [] }),
    canPlanning ? supabase.from("training_sessions").select("session_date").eq("club_id", ctx.clubId).gte("session_date", monday).lte("session_date", addDays(monday, 6)) : Promise.resolve({ data: [] }),
    canPlanning ? supabase.from("calendar_events").select("event_date").eq("club_id", ctx.clubId).gte("event_date", monday).lte("event_date", addDays(monday, 6)) : Promise.resolve({ data: [] }),
    listMatches(ctx, { from: addDays(monday, -2), to: addDays(monday, 12) }),
    canMatches && scope.club.competition
      ? supabase.from("standings").select("id, position, team_name, points, is_own_team").eq("competition_id", scope.club.competition.id).order("position")
      : Promise.resolve({ data: [] }),
  ]);
  const matchDates = matches.filter((m) => m.status !== "annule" && m.status !== "reporte").map((m) => dayOf(m.kickoff_at));
  const week = weekDays(monday).map((date) => ({
    date,
    isToday: date === today,
    label: matchDayLabel(date, matchDates),
    sessions: (sessions ?? []).filter((s) => s.session_date === date).length,
    events: (events ?? []).filter((e) => e.event_date === date).length,
    matches: matchDates.includes(date),
  }));
  // Top 3 + notre équipe si elle n'y est pas.
  const all = standings ?? [];
  const top = all.slice(0, 3);
  const own = all.find((r) => r.is_own_team);
  const table = own && !top.includes(own) ? [...top, own] : top;
  return { canPlanning, canMatches, nextSession: next?.[0] ?? null, week, standings: table };
}
