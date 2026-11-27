"use server";

/** Analyse des adversaires : fiches d'observation. Confidentiel (staff technique), cohérence vérifiée par la base. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError as baseError } from "@/lib/phase2/forms";

type R = { error?: string };
/** Messages explicites des contrôles de la base (cohérence club, match, adversaire). */
const dbError = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "23514" && e.message && !/violates|viole/.test(e.message) ? e.message : baseError(e, fallback);
const uuid = z.uuid();
const optText = (max: number) => z.preprocess((v) => v ?? "", z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable());
const nullable = (v: unknown) => (v === "" || v == null ? null : v);

const fieldsSchema = z.object({
  observed_on: z.iso.date("Date invalide"),
  source: z.enum(["video", "direct", "rapport", "statistiques", "autre"]),
  match_id: z.preprocess(nullable, uuid.nullable()),
  usual_system: optText(40),
  source_detail: optText(300),
  in_possession: optText(3000),
  out_possession: optText(3000),
  transitions: optText(3000),
  set_pieces: optText(3000),
  key_players: optText(3000),
  strengths: optText(3000),
  weaknesses: optText(3000),
  interpretation: optText(3000),
  game_plan: optText(3000),
});

function touch(opponentId?: string) {
  revalidatePath("/tactique/adversaires");
  if (opponentId) revalidatePath(`/tactique/adversaires/${opponentId}`);
}

export async function createScouting(opponentId: string, fd: FormData): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  if (!uuid.safeParse(opponentId).success) return { error: "Action invalide." };
  const s = fieldsSchema.safeParse({ observed_on: fd.get("observed_on"), source: fd.get("source") || "video", match_id: fd.get("match_id") });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("opponent_scouting").insert({ club_id: ctx.clubId, opponent_id: opponentId, ...s.data }).select("id").single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch(opponentId);
  redirect(`/tactique/adversaires/${opponentId}?fiche=${data.id}#fiche-${data.id}`);
}

export async function updateScouting(id: string, patch: Partial<z.input<typeof fieldsSchema>>): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = fieldsSchema.partial().safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("opponent_scouting").update(s.data).eq("id", id).select("opponent_id");
  if (error) return { error: dbError(error, "Modification refusée.") };
  if (!data?.length) return { error: "Modification refusée." };
  touch(data[0].opponent_id);
  return {};
}

export async function deleteScouting(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("opponent_scouting").delete().eq("id", id).select("opponent_id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch(data[0].opponent_id);
  return {};
}
