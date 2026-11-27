"use server";

/** Coups de pied arrêtés : combinaisons, schéma animé, tireuses, responsabilités. Confidentiel (staff technique). */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError as baseError } from "@/lib/phase2/forms";
import { emptyDiagram, parseDiagram } from "@/lib/training/diagram";
import { CATEGORY_PITCH, SET_PIECE_CATEGORIES, SIDES } from "@/components/tactics/set-piece-labels";

type R = { ok?: boolean; error?: string };
const dbError = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "23514" && e.message && !/violates|viole/.test(e.message) ? e.message : baseError(e, fallback);
const uuid = z.uuid();
const optText = (max: number) => z.preprocess((v) => v ?? "", z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable());

const fieldsSchema = z.object({
  name: z.string().trim().min(2, "Nom requis (2 caractères minimum)").max(80, "80 caractères maximum"),
  category: z.enum(SET_PIECE_CATEGORIES),
  side: z.enum(SIDES),
  signal: optText(60),
  instructions: optText(3000),
  notes: optText(2000),
  takers: z.array(uuid).max(5, "5 tireuses maximum"),
  responsibilities: z.array(z.object({
    player_id: uuid.nullable(),
    role: z.string().trim().min(2, "Rôle requis (2 caractères minimum)").max(120),
  })).max(14, "14 responsabilités maximum"),
});

function touch(id?: string) {
  revalidatePath("/tactique/cpa");
  if (id) revalidatePath(`/tactique/cpa/${id}`);
}

export type SetPieceFormState = { error?: string } | undefined;

export async function createSetPiece(_: SetPieceFormState, fd: FormData): Promise<SetPieceFormState> {
  const ctx = await requirePermission("evaluations.write");
  const s = fieldsSchema.pick({ name: true, category: true, side: true }).safeParse({
    name: fd.get("name"), category: fd.get("category"), side: fd.get("side") || "indifferent",
  });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("set_piece_routines")
    .insert({ club_id: ctx.clubId, ...s.data, diagram: emptyDiagram(CATEGORY_PITCH[s.data.category]) as never })
    .select("id").single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch();
  redirect(`/tactique/cpa/${data.id}`);
}

export async function updateSetPiece(id: string, patch: Partial<z.input<typeof fieldsSchema>>): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = fieldsSchema.partial().safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("set_piece_routines").update(s.data as never).eq("id", id).select("id");
  if (error) return { error: dbError(error, "Modification refusée.") };
  if (!data?.length) return { error: "Modification refusée." };
  touch(id);
  return { ok: true };
}

export async function saveSetPieceDiagram(id: string, title: string, data: unknown): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const d = parseDiagram(data);
  if (!d) return { error: "Schéma invalide." };
  const name = z.string().trim().min(2).max(80).safeParse(title);
  const supabase = await createClient();
  const { data: up, error } = await supabase.from("set_piece_routines")
    .update({ diagram: d as never, ...(name.success ? { name: name.data } : {}) }).eq("id", id).select("id");
  if (error || !up?.length) return { error: dbError(error, "Enregistrement refusé.") };
  touch(id);
  return { ok: true };
}

export async function duplicateSetPiece(id: string): Promise<R & { id?: string }> {
  const ctx = await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data: s } = await supabase.from("set_piece_routines")
    .select("category, name, side, signal, instructions, diagram, takers, responsibilities, notes").eq("id", id).maybeSingle();
  if (!s) return { error: "Combinaison introuvable." };
  const { data, error } = await supabase.from("set_piece_routines")
    .insert({ ...s, club_id: ctx.clubId, name: `${s.name} (copie)`.slice(0, 80) }).select("id").single();
  if (error || !data) return { error: dbError(error, "Duplication refusée.") };
  touch();
  return { ok: true, id: data.id };
}

export async function archiveSetPiece(id: string, archived: boolean): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("set_piece_routines")
    .update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch(id);
  return { ok: true };
}

export async function deleteSetPiece(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("set_piece_routines").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  redirect("/tactique/cpa");
}
