import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { listMatches } from "@/lib/phase2/data";
import { dayOf, EVENT_TYPE_LABELS, hm, HOME_AWAY_LABELS, timeOf } from "@/lib/phase2/labels";

export type AgendaItem = {
  id: string;
  kind: "seance" | "match" | "evenement";
  date: string;
  start: string | null;
  end: string | null;
  title: string;
  subtitle: string | null;
  href: string;
  status?: string;
  intensity?: string | null;
  type?: string;
};

/** Agrège séances, rencontres et activités sur une période (sans double saisie). */
export async function loadAgenda(ctx: AccessContext, from: string, to: string): Promise<AgendaItem[]> {
  const supabase = await createClient();
  const canPlanning = ctx.permissions.has("planning.read");
  const [sessions, events, matches] = await Promise.all([
    canPlanning
      ? supabase.from("training_sessions").select("id, number, session_date, starts_at, ends_at, theme, location, status, intensity")
          .eq("club_id", ctx.clubId).gte("session_date", from).lte("session_date", to).order("session_date").order("starts_at")
      : Promise.resolve({ data: [] as never[] }),
    canPlanning
      ? supabase.from("calendar_events").select("id, type, title, event_date, starts_at, ends_at, location, intensity")
          .eq("club_id", ctx.clubId).gte("event_date", from).lte("event_date", to).order("event_date").order("starts_at")
      : Promise.resolve({ data: [] as never[] }),
    listMatches(ctx, { from, to }),
  ]);
  const items: AgendaItem[] = [];
  for (const s of sessions.data ?? []) {
    items.push({
      id: s.id, kind: "seance", date: s.session_date, start: s.starts_at, end: s.ends_at,
      title: `Séance n°${s.number} — ${s.theme}`, subtitle: s.location, href: `/entrainement/seances/${s.id}`,
      status: s.status, intensity: s.intensity,
    });
  }
  for (const e of events.data ?? []) {
    items.push({
      id: e.id, kind: "evenement", date: e.event_date, start: e.starts_at, end: e.ends_at,
      title: e.title, subtitle: [EVENT_TYPE_LABELS[e.type], e.location].filter(Boolean).join(" · "),
      href: `/planification/evenements/${e.id}`, intensity: e.intensity, type: e.type,
    });
  }
  for (const m of matches) {
    items.push({
      id: m.id, kind: "match", date: dayOf(m.kickoff_at), start: timeOf(m.kickoff_at), end: null,
      title: `Match — ${m.opponent}`,
      subtitle: [HOME_AWAY_LABELS[m.home_away], m.competition, m.status === "joue" && m.goals_for != null ? `${m.goals_for}-${m.goals_against}` : null].filter(Boolean).join(" · "),
      href: `/competition/rencontres/${m.id}`, status: m.status,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99"));
}

export const itemTime = (i: AgendaItem) => (i.start ? `${hm(i.start)}${i.end ? `–${hm(i.end)}` : ""}` : "");
export const KIND_STYLES: Record<AgendaItem["kind"], string> = {
  seance: "border-l-fuchsia bg-fuchsia/10",
  match: "border-l-royal bg-royal/15",
  evenement: "border-l-muted-foreground bg-muted",
};
