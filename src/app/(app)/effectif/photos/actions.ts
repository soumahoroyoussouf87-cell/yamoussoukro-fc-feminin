"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTO = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Envoie la photo d'une joueuse (import groupé) et remplace l'ancienne. */
export async function importPlayerPhoto(playerId: string, formData: FormData): Promise<{ ok?: true; error?: string }> {
  const ctx = await requirePermission("players.write");
  if (!z.uuid().safeParse(playerId).success) return { error: "Joueuse inconnue." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Fichier manquant." };
  if (file.size > MAX_PHOTO) return { error: "Photo trop lourde (5 Mo maximum)." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Format non accepté (PNG, JPEG ou WebP)." };

  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("id, photo_path").eq("id", playerId).eq("club_id", ctx.clubId).maybeSingle();
  if (!player) return { error: "Fiche introuvable." };

  const path = `${ctx.clubId}/${playerId}/photo-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("player-photos").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Échec de l'envoi." };
  const { data: updated, error } = await supabase.from("players").update({ photo_path: path }).eq("id", playerId).select("id");
  if (error || !updated?.length) {
    await supabase.storage.from("player-photos").remove([path]);
    return { error: "Enregistrement refusé." };
  }
  if (player.photo_path) await supabase.storage.from("player-photos").remove([player.photo_path]);
  revalidatePath("/effectif");
  revalidatePath(`/effectif/${playerId}`);
  return { ok: true };
}
