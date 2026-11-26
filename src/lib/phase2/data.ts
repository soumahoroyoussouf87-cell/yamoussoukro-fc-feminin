import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getClubHeader, type ClubHeader } from "@/lib/club";
import type { AccessContext } from "@/lib/auth";
import { addDays } from "@/lib/domain/match-day";

export type Scope = { club: ClubHeader; teamId: string | null; seasonId: string | null };

/** Équipe et saison de travail (paramètres du club). */
export const getScope = cache(async (ctx: AccessContext): Promise<Scope> => {
  const club = await getClubHeader(ctx);
  let teamId = club.defaultTeamId;
  if (!teamId) {
    const supabase = await createClient();
    const { data } = await supabase.from("teams").select("id").eq("club_id", ctx.clubId).order("is_default", { ascending: false }).limit(1);
    teamId = data?.[0]?.id ?? null;
  }
  return { club, teamId, seasonId: club.season?.id ?? null };
});

export async function listStaffOptions(ctx: AccessContext) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id, first_name, last_name, status, roles(label)")
    .eq("club_id", ctx.clubId)
    .eq("status", "actif")
    .order("last_name");
  return (data ?? []).map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}${s.roles?.label ? ` — ${s.roles.label}` : ""}`, name: `${s.first_name} ${s.last_name}`, role: s.roles?.label ?? "" }));
}

/** Bornes UTC d'une plage de jours à Abidjan (UTC+0, sans heure d'été). */
export const dayStart = (iso: string) => `${iso}T00:00:00Z`;
export const dayEnd = (iso: string) => `${addDays(iso, 1)}T00:00:00Z`;

export type MatchRow = {
  id: string; kickoff_at: string; venue: string | null; home_away: string; matchday: string | null; status: string;
  goals_for: number | null; goals_against: number | null; opponent: string; competition: string | null; competition_id: string | null;
};

const MATCH_SELECT = "id, kickoff_at, venue, home_away, matchday, status, goals_for, goals_against, competition_id, opponents(name), competitions(name)";

type RawMatch = {
  id: string; kickoff_at: string; venue: string | null; home_away: string; matchday: string | null; status: string;
  goals_for: number | null; goals_against: number | null; competition_id: string | null;
  opponents: { name: string } | null; competitions: { name: string } | null;
};
const toMatch = (m: RawMatch): MatchRow => ({
  id: m.id, kickoff_at: m.kickoff_at, venue: m.venue, home_away: m.home_away, matchday: m.matchday, status: m.status,
  goals_for: m.goals_for, goals_against: m.goals_against, competition_id: m.competition_id,
  opponent: m.opponents?.name ?? "Adversaire", competition: m.competitions?.name ?? null,
});

export async function listMatches(ctx: AccessContext, opts: { from?: string; to?: string; seasonId?: string | null; ascending?: boolean } = {}) {
  if (!ctx.permissions.has("matches.read")) return [] as MatchRow[];
  const supabase = await createClient();
  let q = supabase.from("matches").select(MATCH_SELECT).eq("club_id", ctx.clubId).order("kickoff_at", { ascending: opts.ascending ?? true });
  if (opts.from) q = q.gte("kickoff_at", dayStart(opts.from));
  if (opts.to) q = q.lt("kickoff_at", dayEnd(opts.to));
  if (opts.seasonId) q = q.eq("season_id", opts.seasonId);
  const { data } = await q;
  return ((data ?? []) as unknown as RawMatch[]).map(toMatch);
}

export async function getMatch(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("*, opponents(name, city), competitions(name, squad_size_limit)")
    .eq("id", id)
    .maybeSingle();
  return data;
}
export type MatchFull = NonNullable<Awaited<ReturnType<typeof getMatch>>>;

export function matchTitle(m: { home_away: string; opponents?: { name: string } | null }, clubShort = "YFC Féminin") {
  const opp = m.opponents?.name ?? "Adversaire";
  return m.home_away === "exterieur" ? `${opp} – ${clubShort}` : `${clubShort} – ${opp}`;
}

/** Joueuses actives avec numéro de la saison et poste principal. */
export async function listPlayerOptions(ctx: AccessContext) {
  const supabase = await createClient();
  const scope = await getScope(ctx);
  const { data: players } = await supabase
    .from("players")
    .select("id, first_name, last_name, photo_path, player_positions(is_primary, positions(code, label, line, sort_order))")
    .eq("club_id", ctx.clubId)
    .is("archived_at", null)
    .order("last_name");
  const ids = (players ?? []).map((p) => p.id);
  const [{ data: seasons }, { data: avail }] = await Promise.all([
    scope.seasonId && ids.length
      ? supabase.from("player_seasons").select("player_id, shirt_number").eq("season_id", scope.seasonId).in("player_id", ids)
      : Promise.resolve({ data: [] as { player_id: string; shirt_number: number | null }[] }),
    ctx.permissions.has("availability.read") && ids.length
      ? supabase.from("player_current_availability").select("player_id, status").in("player_id", ids)
      : Promise.resolve({ data: [] as { player_id: string; status: string }[] }),
  ]);
  const shirt = new Map((seasons ?? []).map((s) => [s.player_id, s.shirt_number]));
  const av = new Map((avail ?? []).map((a) => [a.player_id, a.status]));
  const lineOrder: Record<string, number> = { gardienne: 0, defense: 1, milieu: 2, attaque: 3 };
  return (players ?? [])
    .map((p) => {
      const pos = (p.player_positions ?? []) as { is_primary: boolean; positions: { code: string; label: string; line: string; sort_order: number } | null }[];
      const primary = pos.find((x) => x.is_primary)?.positions ?? null;
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        name: `${p.first_name} ${p.last_name}`,
        short: `${p.first_name.charAt(0)}. ${p.last_name}`,
        shirt: shirt.get(p.id) ?? null,
        position: primary?.code ?? null,
        positionLabel: primary?.label ?? null,
        line: primary?.line ?? null,
        sort: (lineOrder[primary?.line ?? ""] ?? 9) * 100 + (primary?.sort_order ?? 99),
        availability: av.get(p.id) ?? null,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.last_name.localeCompare(b.last_name));
}
export type PlayerOption = Awaited<ReturnType<typeof listPlayerOptions>>[number];

export async function getApprovalHistory(entityType: string, entityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_history")
    .select("id, from_status, to_status, created_at, actor_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(20);
  const actors = [...new Set((data ?? []).map((h) => h.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actors.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actors);
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "");
  }
  return (data ?? []).map((h) => ({ ...h, actor: h.actor_id ? names.get(h.actor_id) || "Membre du staff" : "Système" }));
}
