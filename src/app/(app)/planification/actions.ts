"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(app)/effectif/actions";
import { dbError, optEnum, optText, optTime, optUuid, reqDate, zodErrors } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";
import { addDays, dayDiff, mondayOf } from "@/lib/domain/match-day";

const EVENT_TYPES = ["seance_video", "test_physique", "reunion", "deplacement", "stage", "repos", "recuperation", "soins", "autre"] as const;
const INTENSITIES = ["repos", "faible", "moderee", "elevee", "maximale"] as const;

const eventSchema = z
  .object({
    type: z.enum(EVENT_TYPES, "Type requis"),
    title: z.string().trim().min(2, "Titre requis").max(120),
    event_date: reqDate,
    starts_at: optTime,
    ends_at: optTime,
    location: optText(120),
    theme: optText(120),
    sub_theme: optText(120),
    objective: optText(1000),
    intensity: optEnum([...INTENSITIES]),
    responsible_staff_id: optUuid,
    audience: optText(120),
    notes: optText(2000),
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at, { message: "Doit suivre l'heure de début", path: ["ends_at"] });

async function microcycleFor(clubId: string, teamId: string | null, date: string) {
  if (!teamId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("microcycles").select("id").eq("club_id", clubId).eq("team_id", teamId).eq("week_start", mondayOf(date)).maybeSingle();
  return data?.id ?? null;
}

export async function saveEvent(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const scope = await getScope(ctx);
  if (!scope.teamId) return { error: "Aucune équipe configurée (Administration › Paramètres)." };
  const supabase = await createClient();
  const row = { ...parsed.data, microcycle_id: await microcycleFor(ctx.clubId, scope.teamId, parsed.data.event_date) };
  if (id) {
    const { data, error } = await supabase.from("calendar_events").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  } else {
    const { error } = await supabase.from("calendar_events").insert({ ...row, club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId, created_by: ctx.userId });
    if (error) return { error: dbError(error, "Création refusée.") };
  }
  revalidatePath("/planification", "layout");
  redirect(`/planification/programme?semaine=${mondayOf(parsed.data.event_date)}&ok=1`);
}

export async function deleteEvent(id: string) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_events").delete().eq("id", id).select("event_date");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath("/planification", "layout");
  redirect(`/planification/programme?semaine=${mondayOf(data[0].event_date)}`);
}

// ------------------------------------------------------------------ Cycles
const cycleBase = {
  name: z.string().trim().min(2, "Nom requis").max(120),
  starts_on: reqDate,
  ends_on: reqDate,
  objective: optText(1000),
};
const macroSchema = z.object(cycleBase).refine((v) => v.ends_on >= v.starts_on, { message: "Doit suivre la date de début", path: ["ends_on"] });
const mesoSchema = z
  .object({ ...cycleBase, macrocycle_id: z.uuid("Macrocycle requis"), focus: optText(300) })
  .refine((v) => v.ends_on >= v.starts_on, { message: "Doit suivre la date de début", path: ["ends_on"] });

export async function saveMacro(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = macroSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return { error: "Définissez d'abord la saison active et l'équipe (Administration › Paramètres)." };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("macrocycles").update(parsed.data).eq("id", id).select("id")
    : await supabase.from("macrocycles").insert({ ...parsed.data, club_id: ctx.clubId, season_id: scope.seasonId, team_id: scope.teamId }).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath("/planification/cycles");
  redirect("/planification/cycles?ok=1");
}

export async function saveMeso(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = mesoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { data: macro } = await supabase.from("macrocycles").select("starts_on, ends_on").eq("id", parsed.data.macrocycle_id).maybeSingle();
  if (!macro) return { error: "Macrocycle introuvable.", fieldErrors: { macrocycle_id: "Macrocycle introuvable" } };
  if (parsed.data.starts_on < macro.starts_on || parsed.data.ends_on > macro.ends_on)
    return { error: "Le mésocycle doit être compris dans les dates du macrocycle.", fieldErrors: { starts_on: `Entre le ${macro.starts_on} et le ${macro.ends_on}` } };
  const { data, error } = id
    ? await supabase.from("mesocycles").update(parsed.data).eq("id", id).select("id")
    : await supabase.from("mesocycles").insert({ ...parsed.data, club_id: ctx.clubId }).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath("/planification/cycles");
  redirect("/planification/cycles?ok=1#meso");
}

export async function deleteCycle(kind: "macrocycles" | "mesocycles", id: string) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from(kind).delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath("/planification/cycles");
  redirect("/planification/cycles");
}

// ------------------------------------------------------------------ Microcycle / programme hebdomadaire
export async function createMicrocycle(weekStart: string) {
  const ctx = await requirePermission("planning.write");
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return { error: "Définissez d'abord la saison active et l'équipe (Administration › Paramètres)." };
  const supabase = await createClient();
  const monday = mondayOf(weekStart);
  const { data: meso } = await supabase.from("mesocycles").select("id").eq("club_id", ctx.clubId).lte("starts_on", addDays(monday, 6)).gte("ends_on", monday).limit(1);
  const { data, error } = await supabase
    .from("microcycles")
    .insert({ club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId, week_start: monday, mesocycle_id: meso?.[0]?.id ?? null })
    .select("id")
    .single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  // Rattache les séances et activités déjà planifiées sur la semaine.
  await Promise.all([
    supabase.from("training_sessions").update({ microcycle_id: data.id }).eq("club_id", ctx.clubId).eq("team_id", scope.teamId).gte("session_date", monday).lte("session_date", addDays(monday, 6)).is("microcycle_id", null).in("status", ["brouillon", "soumis"]),
    supabase.from("calendar_events").update({ microcycle_id: data.id }).eq("club_id", ctx.clubId).gte("event_date", monday).lte("event_date", addDays(monday, 6)).is("microcycle_id", null),
  ]);
  revalidatePath("/planification/programme");
  return {};
}

const microSchema = z.object({ label: optText(120), objective: optText(1000), mesocycle_id: optUuid });
export async function saveMicrocycle(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("planning.write");
  const parsed = microSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("microcycles").update(parsed.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  revalidatePath("/planification/programme");
  return { ok: "Programme enregistré." };
}

/**
 * Duplique la semaine (séances avec leurs exercices + activités) vers une autre
 * semaine. Les copies repartent en brouillon : elles devront être revalidées.
 */
export async function duplicateWeek(fromMonday: string, toMonday: string) {
  const ctx = await requirePermission("planning.write");
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return { error: "Saison active ou équipe non définie." };
  const from = mondayOf(fromMonday);
  const to = mondayOf(toMonday);
  if (from === to) return { error: "Choisissez une autre semaine." };
  const shift = dayDiff(from, to);
  const supabase = await createClient();
  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from("training_sessions").select("*, session_exercises(*)").eq("club_id", ctx.clubId).eq("team_id", scope.teamId).gte("session_date", from).lte("session_date", addDays(from, 6)),
    supabase.from("calendar_events").select("*").eq("club_id", ctx.clubId).eq("team_id", scope.teamId).gte("event_date", from).lte("event_date", addDays(from, 6)),
  ]);
  if (!sessions?.length && !events?.length) return { error: "La semaine source ne contient ni séance ni activité." };

  let micro = (await supabase.from("microcycles").select("id").eq("team_id", scope.teamId).eq("week_start", to).maybeSingle()).data?.id ?? null;
  if (!micro) {
    const { data } = await supabase.from("microcycles").insert({ club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId, week_start: to }).select("id").single();
    micro = data?.id ?? null;
  }
  for (const s of sessions ?? []) {
    const { data: copy, error } = await supabase
      .from("training_sessions")
      .insert({
        club_id: ctx.clubId, team_id: s.team_id, season_id: scope.seasonId, microcycle_id: micro, session_date: addDays(s.session_date, shift),
        starts_at: s.starts_at, ends_at: s.ends_at, location: s.location, theme: s.theme, sub_theme: s.sub_theme, main_objective: s.main_objective,
        secondary_objectives: s.secondary_objectives, audience: s.audience, intensity: s.intensity, game_system: s.game_system,
        responsible_staff_id: s.responsible_staff_id, equipment: s.equipment, notes: s.notes, created_by: ctx.userId,
      } as never)
      .select("id")
      .single();
    if (error || !copy) return { error: dbError(error, "Duplication interrompue.") };
    const ex = (s.session_exercises ?? []) as { exercise_id: string; block: string; sort_order: number; duration_min: number | null; repetitions: string | null; recovery: string | null; notes: string | null }[];
    if (ex.length)
      await supabase.from("session_exercises").insert(
        ex.map((e) => ({ club_id: ctx.clubId, session_id: copy.id, exercise_id: e.exercise_id, block: e.block, sort_order: e.sort_order, duration_min: e.duration_min, repetitions: e.repetitions, recovery: e.recovery, notes: e.notes })) as never,
      );
  }
  if (events?.length)
    await supabase.from("calendar_events").insert(
      events.map((e) => ({
        club_id: ctx.clubId, team_id: e.team_id, season_id: e.season_id, microcycle_id: micro, type: e.type, title: e.title,
        event_date: addDays(e.event_date, shift), starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, theme: e.theme,
        sub_theme: e.sub_theme, objective: e.objective, intensity: e.intensity, responsible_staff_id: e.responsible_staff_id,
        audience: e.audience, notes: e.notes, created_by: ctx.userId,
      })),
    );
  revalidatePath("/planification", "layout");
  redirect(`/planification/programme?semaine=${to}&copie=1`);
}
