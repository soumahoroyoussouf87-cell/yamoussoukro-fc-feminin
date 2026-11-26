"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(app)/effectif/actions";
import { dbError, emptyToNull, optInt, optText, optTime, optUuid, reqDate, zodErrors } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";

const path = (matchId: string, sub = "") => `/competition/rencontres/${matchId}${sub}`;
const optDateTime = z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides").nullable());
/** Abidjan = UTC+0 toute l'année : l'heure saisie est l'heure UTC. */
const toTs = (local: string | null) => (local ? `${local}:00Z` : null);

// ------------------------------------------------------------------ Rencontres
const matchSchema = z
  .object({
    opponent_id: optUuid,
    new_opponent: optText(80),
    match_date: reqDate,
    match_time: optTime,
    venue: optText(120),
    home_away: z.enum(["domicile", "exterieur", "neutre"]),
    matchday: optText(40),
    competition_id: optUuid,
    duration_min: optInt(20, 130),
    meeting_time: optDateTime,
    meeting_place: optText(160),
    referee: optText(120),
    objectives: optText(2000),
    game_plan: optText(4000),
    briefing: optText(4000),
    logistics: optText(2000),
  })
  .refine((v) => v.opponent_id || v.new_opponent, { message: "Choisissez ou saisissez l'adversaire", path: ["opponent_id"] });

export async function saveMatch(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("matches.write");
  const parsed = matchSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const v = parsed.data;
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return { error: "Définissez d'abord la saison active et l'équipe (Administration › Paramètres)." };
  const supabase = await createClient();
  let opponentId = v.opponent_id;
  if (!opponentId && v.new_opponent) {
    const { data: existing } = await supabase.from("opponents").select("id").eq("club_id", ctx.clubId).ilike("name", v.new_opponent).maybeSingle();
    if (existing) opponentId = existing.id;
    else {
      const { data, error } = await supabase.from("opponents").insert({ club_id: ctx.clubId, name: v.new_opponent }).select("id").single();
      if (error || !data) return { error: dbError(error, "Création de l'adversaire refusée.") };
      opponentId = data.id;
    }
  }
  const row = {
    opponent_id: opponentId!,
    kickoff_at: `${v.match_date}T${(v.match_time ?? "15:00").slice(0, 5)}:00Z`,
    venue: v.venue, home_away: v.home_away, matchday: v.matchday, competition_id: v.competition_id ?? scope.club.competition?.id ?? null,
    duration_min: v.duration_min ?? 90, meeting_time: toTs(v.meeting_time), meeting_place: v.meeting_place, referee: v.referee,
    objectives: v.objectives, game_plan: v.game_plan, briefing: v.briefing, logistics: v.logistics,
  };
  let matchId = id;
  if (id) {
    const { data, error } = await supabase.from("matches").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  } else {
    const { data, error } = await supabase.from("matches").insert({ ...row, club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId }).select("id").single();
    if (error || !data) return { error: dbError(error, "Création refusée.") };
    matchId = data.id;
  }
  revalidatePath("/competition", "layout");
  redirect(`${path(matchId!)}?ok=1`);
}

export async function deleteMatch(id: string) {
  await requirePermission("matches.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("matches").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath("/competition", "layout");
  redirect("/competition/rencontres");
}

const resultSchema = z
  .object({
    status: z.enum(["programme", "joue", "reporte", "annule"]),
    goals_for: optInt(0, 50),
    goals_against: optInt(0, 50),
    post_report: optText(6000),
    development_axes: optText(3000),
  })
  .refine((v) => v.status !== "joue" || (v.goals_for != null && v.goals_against != null), { message: "Score requis pour un match joué", path: ["goals_for"] });

export async function saveResult(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("matches.write");
  const parsed = resultSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const row = v.status === "joue" ? v : { ...v, goals_for: null, goals_against: null };
  const { data, error } = await supabase.from("matches").update(row).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath("/competition", "layout");
  revalidatePath("/tableau-de-bord");
  return { ok: "Résultat et rapport enregistrés." };
}

// ------------------------------------------------------------------ Convocations
export async function createSquad(matchId: string) {
  const ctx = await requirePermission("matches.write");
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("competitions(squad_size_limit)").eq("id", matchId).single();
  const limit = m?.competitions?.squad_size_limit ?? 18;
  const { error } = await supabase.from("match_squads").insert({ club_id: ctx.clubId, match_id: matchId, size_limit: limit });
  if (error) return { error: dbError(error, "Création refusée.") };
  revalidatePath(path(matchId, "/convocations"));
  return {};
}

const SQUAD = ["convoquee", "reserviste", "non_retenue"] as const;
export async function saveSquad(squadId: string, matchId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("matches.write");
  const canComment = ctx.permissions.has("lineups.read_draft");
  const head = z.object({ size_limit: z.coerce.number().int().min(11, "Minimum 11").max(40, "Maximum 40"), notes: optText(2000) }).safeParse({
    size_limit: formData.get("size_limit"), notes: formData.get("notes"),
  });
  if (!head.success) return zodErrors(head.error);
  type Row = { player_id: string; status: (typeof SQUAD)[number] | ""; shirt: number | null; comment: string | null };
  const rows: Row[] = [];
  for (const [k, val] of formData.entries()) {
    if (!k.startsWith("st_")) continue;
    const pid = k.slice(3);
    if (!z.uuid().safeParse(pid).success) continue;
    const st = String(val);
    if (st && !(SQUAD as readonly string[]).includes(st)) continue;
    const shirtRaw = String(formData.get(`no_${pid}`) ?? "").trim();
    const shirt = shirtRaw ? Number(shirtRaw) : null;
    if (shirt != null && (!Number.isInteger(shirt) || shirt < 1 || shirt > 99)) return { error: "Numéro de maillot invalide (1 à 99)." };
    rows.push({ player_id: pid, status: st as Row["status"], shirt, comment: (emptyToNull(String(formData.get(`cm_${pid}`) ?? "")) as string | null)?.slice(0, 500) ?? null });
  }
  const convoked = rows.filter((r) => r.status === "convoquee").length;
  if (convoked > head.data.size_limit) return { error: `Liste complète : ${head.data.size_limit} convoquées maximum (vous en avez sélectionné ${convoked}).` };
  const shirts = rows.filter((r) => r.status && r.shirt != null).map((r) => r.shirt);
  if (new Set(shirts).size !== shirts.length) return { error: "Deux joueuses ont le même numéro de maillot." };

  const supabase = await createClient();
  const { error: hErr } = await supabase.from("match_squads").update(head.data).eq("id", squadId);
  if (hErr) return { error: dbError(hErr, "Enregistrement refusé.") };
  const { data: existing } = await supabase.from("match_squad_players").select("id, player_id").eq("squad_id", squadId);
  const byPlayer = new Map((existing ?? []).map((e) => [e.player_id, e.id]));
  const toDelete = rows.filter((r) => !r.status && byPlayer.has(r.player_id)).map((r) => byPlayer.get(r.player_id)!);
  if (toDelete.length) {
    const { error } = await supabase.from("match_squad_players").delete().in("id", toDelete);
    if (error) return { error: dbError(error, "Enregistrement refusé.") };
  }
  // Les rétrogradations passent avant les convocations pour respecter la limite à chaque étape.
  const ordered = rows.filter((r) => r.status).sort((a, b) => (a.status === "convoquee" ? 1 : 0) - (b.status === "convoquee" ? 1 : 0));
  for (const r of ordered) {
    const base = { status: r.status as (typeof SQUAD)[number], shirt_number: r.shirt, ...(canComment ? { confidential_comment: r.comment } : {}) };
    const id = byPlayer.get(r.player_id);
    const { error } = id
      ? await supabase.from("match_squad_players").update(base).eq("id", id)
      : await supabase.from("match_squad_players").insert({ ...base, club_id: ctx.clubId, squad_id: squadId, player_id: r.player_id });
    if (error) return { error: dbError(error, "Enregistrement refusé.") };
  }
  revalidatePath(path(matchId), "layout");
  return { ok: `Convocation enregistrée : ${convoked} convoquée(s), ${rows.filter((r) => r.status === "reserviste").length} réserviste(s).` };
}

// ------------------------------------------------------------------ Onze de départ
const lineupPlayer = z.object({
  player_id: z.uuid(),
  slot: z.enum(["titulaire", "remplacante"]),
  position_label: z.string().max(12).nullable(),
  x: z.number().min(0).max(100).nullable(),
  y: z.number().min(0).max(100).nullable(),
  is_captain: z.boolean(),
  takes_penalties: z.boolean(),
  takes_free_kicks: z.boolean(),
  takes_corners: z.boolean(),
  responsibilities: z.string().max(500).nullable(),
});
const lineupPayload = z.object({
  id: z.uuid().nullable(),
  label: z.string().trim().min(2).max(60),
  system: z.string().trim().min(3).max(40),
  instructions: z.string().max(3000).nullable(),
  players: z.array(lineupPlayer).max(40),
});
export type LineupPayload = z.infer<typeof lineupPayload>;

export async function saveLineup(matchId: string, payload: LineupPayload): Promise<{ error?: string; id?: string }> {
  const ctx = await requireStaff();
  if (!ctx.permissions.has("lineups.write") && !ctx.permissions.has("lineups.validate")) return { error: "Action non autorisée pour votre rôle." };
  const parsed = lineupPayload.safeParse(payload);
  if (!parsed.success) return { error: "Composition invalide." };
  const v = parsed.data;
  const starters = v.players.filter((p) => p.slot === "titulaire");
  if (starters.length > 11) return { error: "11 titulaires maximum." };
  if (v.players.filter((p) => p.is_captain).length > 1) return { error: "Une seule capitaine." };
  if (new Set(v.players.map((p) => p.player_id)).size !== v.players.length) return { error: "Une joueuse apparaît deux fois." };
  const supabase = await createClient();
  let id = v.id;
  let version = 1;
  let status: "provisoire" | "validee" | "communiquee" = "provisoire";
  if (id) {
    const { data: cur } = await supabase.from("lineups").select("version, status").eq("id", id).single();
    version = (cur?.version ?? 0) + 1;
    status = cur?.status ?? "provisoire";
    const { data, error } = await supabase.from("lineups").update({ label: v.label, system: v.system, instructions: v.instructions, version }).eq("id", id).select("id");
    if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  } else {
    const { data, error } = await supabase.from("lineups").insert({ club_id: ctx.clubId, match_id: matchId, label: v.label, system: v.system, instructions: v.instructions }).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? "Une composition porte déjà ce nom pour ce match." : dbError(error, "Création refusée.") };
    id = data.id;
  }
  const { error: delErr } = await supabase.from("lineup_players").delete().eq("lineup_id", id!);
  if (delErr) return { error: dbError(delErr, "Enregistrement refusé.") };
  if (v.players.length) {
    const { error } = await supabase.from("lineup_players").insert(v.players.map((p, i) => ({ ...p, club_id: ctx.clubId, lineup_id: id!, sort_order: i })));
    if (error) return { error: dbError(error, "Enregistrement des joueuses refusé.") };
  }
  await supabase.from("lineup_snapshots").insert({ club_id: ctx.clubId, lineup_id: id!, version, status, data: { system: v.system, instructions: v.instructions, players: v.players }, saved_by: ctx.userId });
  revalidatePath(path(matchId, "/onze"));
  return { id: id! };
}

export async function setLineupStatus(matchId: string, lineupId: string, to: string) {
  await requirePermission("lineups.validate");
  if (!["provisoire", "validee", "communiquee"].includes(to)) return { error: "Statut invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lineups").update({ status: to as "provisoire" }).eq("id", lineupId).select("id");
  if (error?.code === "23505") return { error: "Une autre composition est déjà officielle pour ce match : repassez-la en provisoire d'abord." };
  if (error || !data?.length) return { error: dbError(error, "Changement refusé.") };
  revalidatePath(path(matchId), "layout");
  return {};
}

export async function deleteLineup(matchId: string, lineupId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("lineups").delete().eq("id", lineupId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath(path(matchId, "/onze"));
  redirect(path(matchId, "/onze"));
}

// ------------------------------------------------------------------ Événements de match
const EVENTS = ["but", "but_adverse", "csc_pour", "csc_contre", "penalty_manque", "carton_jaune", "carton_rouge", "remplacement", "changement_tactique", "blessure", "observation"] as const;
const eventSchema = z
  .object({
    period: z.enum(["1MT", "2MT", "PROL1", "PROL2", "TAB"]),
    minute: z.coerce.number().int("Minute invalide").min(0, "Minute invalide").max(130, "Minute invalide"),
    added_minute: optInt(1, 30),
    type: z.enum(EVENTS, "Type requis"),
    player_id: optUuid,
    related_player_id: optUuid,
    note: optText(500),
  })
  .refine((v) => !["but", "carton_jaune", "carton_rouge", "remplacement"].includes(v.type) || v.player_id, { message: "Joueuse requise", path: ["player_id"] })
  .refine((v) => v.type !== "remplacement" || (v.related_player_id && v.related_player_id !== v.player_id), { message: "Joueuse entrante requise (différente)", path: ["related_player_id"] });

export async function addMatchEvent(matchId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("matches.write");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("match_events").insert({
    ...v,
    player_id: ["but_adverse", "csc_pour"].includes(v.type) ? null : v.player_id,
    related_player_id: ["but", "remplacement"].includes(v.type) ? v.related_player_id : null,
    club_id: ctx.clubId, match_id: matchId, created_by: ctx.userId,
  });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath(path(matchId), "layout");
  return { ok: "Événement ajouté." };
}

export async function deleteMatchEvent(matchId: string, eventId: string) {
  await requirePermission("matches.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("match_events").delete().eq("id", eventId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath(path(matchId), "layout");
  return {};
}

export async function applyEventScore(matchId: string, us: number, them: number) {
  await requirePermission("matches.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("matches").update({ status: "joue", goals_for: us, goals_against: them }).eq("id", matchId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath("/competition", "layout");
  revalidatePath("/tableau-de-bord");
  return {};
}

// ------------------------------------------------------------------ Délégations
export async function createDelegation(matchId: string) {
  const ctx = await requirePermission("delegations.write");
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("kickoff_at").eq("id", matchId).single();
  const { error } = await supabase.from("delegations").insert({ club_id: ctx.clubId, match_id: matchId, departure_at: null, return_at: null });
  if (error || !m) return { error: dbError(error, "Création refusée.") };
  revalidatePath(path(matchId, "/delegation"));
  return {};
}

const delegationSchema = z
  .object({
    head_staff_id: optUuid,
    driver: optText(120),
    transport: optText(1000),
    departure_at: optDateTime,
    return_at: optDateTime,
    accommodation: optText(1000),
    catering: optText(1000),
    schedule: optText(3000),
    equipment: optText(2000),
    budget_planned: optInt(0, 999_999_999),
    budget_actual: optInt(0, 999_999_999),
    trip_program: optText(4000),
  })
  .refine((v) => !v.departure_at || !v.return_at || v.return_at >= v.departure_at, { message: "Doit suivre le départ", path: ["return_at"] });

export async function saveDelegation(id: string, matchId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("delegations.write");
  const parsed = delegationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("delegations").update({ ...v, departure_at: toTs(v.departure_at), return_at: toTs(v.return_at) }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath(path(matchId, "/delegation"));
  return { ok: "Délégation enregistrée." };
}

const GROUPS = ["joueuse", "staff_technique", "staff_performance", "staff_medical", "administration", "communication", "logistique", "autre"] as const;
const memberSchema = z
  .object({
    member_group: z.enum(GROUPS, "Groupe requis"),
    staff_member_id: optUuid,
    external_name: optText(120),
    function_label: optText(80),
    room: optText(20),
  })
  .refine((v) => (v.staff_member_id ? 1 : 0) + (v.external_name ? 1 : 0) === 1, { message: "Choisissez un membre du staff OU saisissez un nom", path: ["staff_member_id"] })
  .refine((v) => v.member_group !== "joueuse", { message: "Les joueuses s'ajoutent depuis la convocation", path: ["member_group"] });

export async function addDelegationMember(delegationId: string, matchId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("delegations.write");
  const parsed = memberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("delegation_members").insert({ ...parsed.data, club_id: ctx.clubId, delegation_id: delegationId });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  revalidatePath(path(matchId, "/delegation"));
  return { ok: "Membre ajouté." };
}

export async function importSquadToDelegation(delegationId: string, matchId: string) {
  const ctx = await requirePermission("delegations.write");
  const supabase = await createClient();
  const { data: squad } = await supabase.from("match_squads").select("id, match_squad_players(player_id, status)").eq("match_id", matchId).maybeSingle();
  const convoked = (squad?.match_squad_players ?? []).filter((p) => p.status === "convoquee").map((p) => p.player_id);
  if (!convoked.length) return { error: "Aucune joueuse convoquée pour ce match." };
  const { data: existing } = await supabase.from("delegation_members").select("player_id").eq("delegation_id", delegationId).not("player_id", "is", null);
  const have = new Set((existing ?? []).map((e) => e.player_id));
  const toAdd = convoked.filter((p) => !have.has(p));
  if (toAdd.length) {
    const { error } = await supabase.from("delegation_members").insert(toAdd.map((player_id) => ({ club_id: ctx.clubId, delegation_id: delegationId, member_group: "joueuse" as const, player_id })));
    if (error) return { error: dbError(error, "Import refusé.") };
  }
  revalidatePath(path(matchId, "/delegation"));
  return {};
}

export async function removeDelegationMember(matchId: string, memberId: string) {
  await requirePermission("delegations.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("delegation_members").delete().eq("id", memberId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath(path(matchId, "/delegation"));
  return {};
}

export async function updateMemberRoom(matchId: string, memberId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("delegations.write");
  const v = z.object({ room: optText(20), function_label: optText(80) }).safeParse(Object.fromEntries(formData.entries()));
  if (!v.success) return zodErrors(v.error);
  const supabase = await createClient();
  const { error } = await supabase.from("delegation_members").update(v.data).eq("id", memberId);
  if (error) return { error: dbError(error, "Refusé.") };
  revalidatePath(path(matchId, "/delegation"));
  return { ok: "OK" };
}

// ------------------------------------------------------------------ Classement
const standingSchema = z
  .object({
    team_name: z.string().trim().min(2, "Équipe requise").max(80),
    is_own_team: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    position: z.coerce.number().int().min(1, "Position invalide").max(40, "Position invalide"),
    played: z.coerce.number().int().min(0).max(99),
    won: z.coerce.number().int().min(0).max(99),
    drawn: z.coerce.number().int().min(0).max(99),
    lost: z.coerce.number().int().min(0).max(99),
    goals_for: z.coerce.number().int().min(0).max(999),
    goals_against: z.coerce.number().int().min(0).max(999),
    points: z.coerce.number().int().min(-99).max(300),
    as_of: reqDate,
  })
  .refine((v) => v.won + v.drawn + v.lost === v.played, { message: "V + N + D doit égaler le nombre de matchs joués", path: ["played"] });

export async function saveStanding(id: string | null, competitionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("matches.write");
  const raw = Object.fromEntries(formData.entries());
  const parsed = standingSchema.safeParse({ ...raw, is_own_team: raw.is_own_team ?? "false" });
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("standings").update(parsed.data).eq("id", id).select("id")
    : await supabase.from("standings").insert({ ...parsed.data, club_id: ctx.clubId, competition_id: competitionId }).select("id");
  if (error || !data?.length) return { error: error?.code === "23505" ? "Cette équipe est déjà au classement (ou une autre ligne est déjà marquée « notre équipe »)." : dbError(error, "Enregistrement refusé.") };
  revalidatePath("/competition/classement");
  revalidatePath("/tableau-de-bord");
  if (id) redirect("/competition/classement?ok=1");
  return { ok: "Ligne ajoutée au classement." };
}

export async function deleteStanding(id: string) {
  await requirePermission("matches.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("standings").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath("/competition/classement");
  return {};
}
