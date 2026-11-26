"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(app)/effectif/actions";
import { dbError, emptyToNull, optEnum, optInt, optText, optTime, optUuid, reqDate, zodErrors } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";
import { mondayOf } from "@/lib/domain/match-day";

const INTENSITIES = ["repos", "faible", "moderee", "elevee", "maximale"] as const;
const BLOCKS = ["activation", "echauffement", "mise_en_train", "situation_apprentissage", "exercice_technique", "exercice_tactique", "jeu_dirige", "jeu_application", "retour_au_calme"] as const;
const CATEGORIES = ["technique_offensive", "technique_defensive", "tactique_offensive", "tactique_defensive", "transition_offensive", "transition_defensive", "pressing", "cpa", "gardiennes", "endurance", "vitesse", "coordination", "developpement_individuel", "developpement_sectoriel", "developpement_collectif"] as const;
const ATTENDANCE = ["present", "retard", "absente_justifiee", "absente_non_justifiee", "blessee", "dispensee"] as const;

// ------------------------------------------------------------------ Séances
const sessionSchema = z
  .object({
    session_date: reqDate,
    starts_at: optTime,
    ends_at: optTime,
    location: optText(120),
    theme: z.string().trim().min(2, "Thème requis").max(120),
    sub_theme: optText(120),
    main_objective: optText(1000),
    secondary_objectives: optText(2000),
    audience: optText(120),
    intensity: optEnum([...INTENSITIES]),
    game_system: optText(40),
    responsible_staff_id: optUuid,
    equipment: optText(1000),
    notes: optText(2000),
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at, { message: "Doit suivre l'heure de début", path: ["ends_at"] });

export async function saveSession(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = sessionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return { error: "Définissez d'abord la saison active et l'équipe (Administration › Paramètres)." };
  const supabase = await createClient();
  const { data: micro } = await supabase.from("microcycles").select("id").eq("team_id", scope.teamId).eq("week_start", mondayOf(parsed.data.session_date)).maybeSingle();
  const row = { ...parsed.data, microcycle_id: micro?.id ?? null };
  let sessionId = id;
  if (id) {
    const { data, error } = await supabase.from("training_sessions").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  } else {
    const { data, error } = await supabase
      .from("training_sessions")
      .insert({ ...row, club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId, created_by: ctx.userId } as never)
      .select("id")
      .single();
    if (error || !data) return { error: dbError(error, "Création refusée.") };
    sessionId = (data as { id: string }).id;
  }
  revalidatePath("/entrainement", "layout");
  revalidatePath("/planification", "layout");
  redirect(`/entrainement/seances/${sessionId}?ok=1`);
}

export async function deleteSession(id: string) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_sessions").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée (une séance validée ne peut être supprimée que par un valideur).") };
  revalidatePath("/entrainement", "layout");
  redirect("/entrainement/seances");
}

export async function duplicateSession(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const date = z.iso.date().safeParse(formData.get("date"));
  if (!date.success) return { error: "Date invalide.", fieldErrors: { date: "Date invalide" } };
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions").select("*, session_exercises(*)").eq("id", id).maybeSingle();
  if (!s || !scope.seasonId) return { error: "Séance introuvable." };
  const { data: micro } = await supabase.from("microcycles").select("id").eq("team_id", s.team_id).eq("week_start", mondayOf(date.data)).maybeSingle();
  const { data: copy, error } = await supabase
    .from("training_sessions")
    .insert({
      club_id: ctx.clubId, team_id: s.team_id, season_id: scope.seasonId, microcycle_id: micro?.id ?? null, session_date: date.data,
      starts_at: s.starts_at, ends_at: s.ends_at, location: s.location, theme: s.theme, sub_theme: s.sub_theme, main_objective: s.main_objective,
      secondary_objectives: s.secondary_objectives, audience: s.audience, intensity: s.intensity, game_system: s.game_system,
      responsible_staff_id: s.responsible_staff_id, equipment: s.equipment, notes: s.notes, created_by: ctx.userId,
    } as never)
    .select("id")
    .single();
  if (error || !copy) return { error: dbError(error, "Duplication refusée.") };
  const copyId = (copy as { id: string }).id;
  const ex = s.session_exercises ?? [];
  if (ex.length)
    await supabase.from("session_exercises").insert(
      ex.map((e) => ({ club_id: ctx.clubId, session_id: copyId, exercise_id: e.exercise_id, block: e.block, sort_order: e.sort_order, duration_min: e.duration_min, repetitions: e.repetitions, recovery: e.recovery, notes: e.notes })),
    );
  revalidatePath("/entrainement", "layout");
  redirect(`/entrainement/seances/${copyId}?copie=1`);
}

// ------------------------------------------------------------------ Contenu de séance
const itemSchema = z.object({
  block: z.enum(BLOCKS, "Bloc requis"),
  exercise_id: z.uuid("Exercice requis"),
  duration_min: optInt(1, 180),
  repetitions: optText(60),
  recovery: optText(60),
  notes: optText(1000),
});

export async function addSessionExercise(sessionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = itemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { data: last } = await supabase.from("session_exercises").select("sort_order").eq("session_id", sessionId).eq("block", parsed.data.block).order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("session_exercises").insert({ ...parsed.data, club_id: ctx.clubId, session_id: sessionId, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  revalidatePath(`/entrainement/seances/${sessionId}`);
  return { ok: "Exercice ajouté à la séance." };
}

export async function removeSessionExercise(sessionId: string, itemId: string) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_exercises").delete().eq("id", itemId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  revalidatePath(`/entrainement/seances/${sessionId}`);
  return {};
}

export async function moveSessionExercise(sessionId: string, itemId: string, dir: -1 | 1) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data: item } = await supabase.from("session_exercises").select("block").eq("id", itemId).single();
  if (!item) return { error: "Introuvable." };
  const { data: list } = await supabase.from("session_exercises").select("id, sort_order").eq("session_id", sessionId).eq("block", item.block).order("sort_order").order("created_at");
  const arr = list ?? [];
  const i = arr.findIndex((x) => x.id === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return {};
  [arr[i], arr[j]] = [arr[j], arr[i]];
  for (let k = 0; k < arr.length; k++) {
    const { error } = await supabase.from("session_exercises").update({ sort_order: k + 1 }).eq("id", arr[k].id);
    if (error) return { error: dbError(error, "Déplacement refusé.") };
  }
  revalidatePath(`/entrainement/seances/${sessionId}`);
  return {};
}

// ------------------------------------------------------------------ Présences
export async function saveAttendance(sessionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const supabase = await createClient();
  const upserts: { club_id: string; session_id: string; player_id: string; status: (typeof ATTENDANCE)[number]; note: string | null; recorded_by: string }[] = [];
  const clear: string[] = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("status_")) continue;
    const pid = k.slice(7);
    if (!z.uuid().safeParse(pid).success) continue;
    const st = String(v);
    const note = emptyToNull(String(formData.get(`note_${pid}`) ?? "")) as string | null;
    if (!st) clear.push(pid);
    else if ((ATTENDANCE as readonly string[]).includes(st))
      upserts.push({ club_id: ctx.clubId, session_id: sessionId, player_id: pid, status: st as (typeof ATTENDANCE)[number], note: note?.slice(0, 300) ?? null, recorded_by: ctx.userId });
  }
  if (upserts.length) {
    const { error } = await supabase.from("training_attendance").upsert(upserts, { onConflict: "session_id,player_id" });
    if (error) return { error: dbError(error, "Enregistrement des présences refusé.") };
  }
  if (clear.length) await supabase.from("training_attendance").delete().eq("session_id", sessionId).in("player_id", clear);
  revalidatePath(`/entrainement/seances/${sessionId}`, "layout");
  revalidatePath("/entrainement/presences");
  return { ok: `${upserts.length} présence(s) enregistrée(s).` };
}

// ------------------------------------------------------------------ Évaluation de séance
const evalSchema = z.object({
  objectives_reached: optInt(1, 5),
  engagement: optInt(1, 5),
  intensity_observed: optEnum([...INTENSITIES]),
  actual_duration_min: optInt(1, 300),
  strengths: optText(2000),
  improvements: optText(2000),
});
export async function saveSessionEvaluation(sessionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const parsed = evalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("session_evaluations")
    .upsert({ ...parsed.data, club_id: ctx.clubId, session_id: sessionId, evaluated_by: ctx.userId }, { onConflict: "session_id" });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  revalidatePath(`/entrainement/seances/${sessionId}`);
  revalidatePath("/entrainement/evaluations");
  return { ok: "Évaluation de la séance enregistrée." };
}

// ------------------------------------------------------------------ Bibliothèque d'exercices
const exerciseSchema = z.object({
  title: z.string().trim().min(2, "Titre requis").max(120),
  category: z.enum(CATEGORIES, "Catégorie requise"),
  objective: optText(1000),
  organisation: optText(3000),
  dimensions: optText(60),
  players_count: optText(60),
  duration_min: optInt(1, 180),
  repetitions: optText(60),
  recovery: optText(60),
  instructions: optText(3000),
  success_criteria: optText(2000),
  variables: optText(2000),
  corrections: optText(2000),
  video_url: z.preprocess(emptyToNull, z.url({ protocol: /^https$/, message: "Lien https:// attendu" }).max(500).nullable()),
});

export async function saveExercise(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("planning.write");
  const entries = Object.fromEntries([...formData.entries()].filter(([k]) => k !== "diagram"));
  const parsed = exerciseSchema.safeParse(entries);
  if (!parsed.success) return zodErrors(parsed.error);
  const supabase = await createClient();
  let exId = id;
  if (id) {
    const { data, error } = await supabase.from("exercises").update(parsed.data).eq("id", id).select("id");
    if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  } else {
    const { data, error } = await supabase.from("exercises").insert({ ...parsed.data, club_id: ctx.clubId, created_by: ctx.userId }).select("id").single();
    if (error || !data) return { error: error?.code === "23505" ? "Un exercice porte déjà ce titre." : dbError(error, "Création refusée.") };
    exId = data.id;
  }
  const file = formData.get("diagram") as File | null;
  if (file && file.size > 0) {
    if (file.size > 3 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return { error: "Schéma invalide (PNG, JPEG ou WebP, 3 Mo max.). L'exercice est enregistré sans schéma.", fieldErrors: { diagram: "Fichier invalide" } };
    const path = `${ctx.clubId}/${exId}/schema-${Date.now()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const { error } = await supabase.storage.from("exercise-diagrams").upload(path, file, { contentType: file.type });
    if (error) return { error: "Échec de l'envoi du schéma." };
    const { data: old } = await supabase.from("exercises").select("diagram_path").eq("id", exId!).single();
    await supabase.from("exercises").update({ diagram_path: path }).eq("id", exId!);
    if (old?.diagram_path) await supabase.storage.from("exercise-diagrams").remove([old.diagram_path]);
  }
  revalidatePath("/entrainement/exercices", "layout");
  redirect(`/entrainement/exercices/${exId}?ok=1`);
}

export async function archiveExercise(id: string, archive: boolean) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Action refusée.") };
  revalidatePath("/entrainement/exercices", "layout");
  return {};
}

export async function deleteExercise(id: string) {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").delete().eq("id", id).select("diagram_path");
  if (error?.code === "23503") return { error: "Cet exercice est utilisé dans des séances : archivez-le plutôt." };
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  if (data[0].diagram_path) await supabase.storage.from("exercise-diagrams").remove([data[0].diagram_path]);
  revalidatePath("/entrainement/exercices", "layout");
  redirect("/entrainement/exercices");
}
