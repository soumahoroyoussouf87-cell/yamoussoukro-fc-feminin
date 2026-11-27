"use server";

/** Tâches du staff : création, suivi, attribution. Droits et notification appliqués par la base. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError as baseError } from "@/lib/phase2/forms";

type R = { error?: string };
/** Messages explicites des contrôles de la base (cohérence club, match, adversaire). */
const dbError = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "23514" && e.message && !/violates|viole/.test(e.message) ? e.message : baseError(e, fallback);
const uuid = z.uuid();
const optText = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable();
const nullable = (v: unknown) => (v === "" || v == null ? null : v);

const STATUSES = ["a_faire", "en_cours", "terminee", "annulee"] as const;
const PRIORITIES = ["basse", "normale", "haute"] as const;

const taskSchema = z.object({
  title: z.string().trim().min(2, "Titre requis (2 caractères minimum)").max(160),
  description: z.preprocess((v) => v ?? "", optText(2000)),
  assignee_staff_id: z.preprocess(nullable, uuid.nullable()),
  due_on: z.preprocess(nullable, z.iso.date("Date invalide").nullable()),
  priority: z.enum(PRIORITIES),
  match_id: z.preprocess(nullable, uuid.nullable()),
  training_session_id: z.preprocess(nullable, uuid.nullable()),
});

function touch() {
  revalidatePath("/taches");
  revalidatePath("/tableau-de-bord");
}

export type TaskFormState = { error?: string; ok?: boolean } | undefined;

export async function createTask(_: TaskFormState, fd: FormData): Promise<TaskFormState> {
  const ctx = await requireStaff();
  const s = taskSchema.safeParse({
    title: fd.get("title"), description: fd.get("description"), assignee_staff_id: fd.get("assignee_staff_id"),
    due_on: fd.get("due_on"), priority: fd.get("priority") || "normale", match_id: fd.get("match_id"), training_session_id: fd.get("training_session_id"),
  });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_tasks").insert({ club_id: ctx.clubId, ...s.data });
  if (error) return { error: dbError(error, "Création refusée.") };
  touch();
  return { ok: true };
}

export async function updateTask(id: string, patch: Partial<z.input<typeof taskSchema>> & { status?: string }): Promise<R> {
  await requireStaff();
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = taskSchema.partial().extend({ status: z.enum(STATUSES).optional() }).safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff_tasks").update(s.data).eq("id", id).select("id");
  if (error) return { error: dbError(error, "Modification refusée.") };
  if (!data?.length) return { error: "Seules la personne désignée, l'auteur ou l'encadrement peuvent modifier cette tâche." };
  touch();
  return {};
}

export async function deleteTask(id: string): Promise<R> {
  await requireStaff();
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff_tasks").delete().eq("id", id).select("id");
  if (error) return { error: dbError(error, "Suppression refusée.") };
  if (!data?.length) return { error: "Seuls l'auteur ou l'encadrement peuvent supprimer cette tâche." };
  touch();
  return {};
}
