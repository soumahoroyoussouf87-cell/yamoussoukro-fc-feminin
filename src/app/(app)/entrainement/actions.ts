"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(app)/effectif/actions";
import { dbError, emptyToNull, optInt, optText, zodErrors } from "@/lib/phase2/forms";


const CATEGORIES = ["technique_offensive", "technique_defensive", "tactique_offensive", "tactique_defensive", "transition_offensive", "transition_defensive", "pressing", "cpa", "gardiennes", "endurance", "vitesse", "coordination", "developpement_individuel", "developpement_sectoriel", "developpement_collectif"] as const;

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
  redirect(id ? `/entrainement/exercices/${exId}?ok=1` : `/entrainement/exercices/${exId}/modifier`);
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
