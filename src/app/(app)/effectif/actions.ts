"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, type AccessContext } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = z.preprocess(emptyToNull, z.string().trim().max(120).nullable());
const optDate = z.preprocess(emptyToNull, z.iso.date("Date invalide").nullable());
const optInt = (min: number, max: number, msg: string) =>
  z.preprocess(emptyToNull, z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

const playerSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  birth_date: optDate,
  nationality: optText,
  height_cm: optInt(120, 220, "Taille entre 120 et 220 cm"),
  preferred_foot: z.preprocess(emptyToNull, z.enum(["droit", "gauche", "deux"]).nullable()),
  joined_on: optDate,
  admin_status: z.enum(["licenciee", "en_cours", "non_licenciee", "pret", "essai", "partie"]),
  licence_number: optText,
  shirt_number: optInt(1, 99, "Numéro entre 1 et 99"),
  tactical_role: optText,
  primary_position: z.preprocess(emptyToNull, z.uuid().nullable()),
  secondary_positions: z.array(z.uuid()).default([]),
});

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function parse(formData: FormData) {
  return playerSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    secondary_positions: formData.getAll("secondary_positions").filter((v) => typeof v === "string" && v),
  });
}

function fieldErrors(error: z.ZodError): FormState {
  const fe: Record<string, string> = {};
  for (const issue of error.issues) fe[String(issue.path[0])] ??= issue.message;
  return { error: "Certains champs sont invalides.", fieldErrors: fe };
}

function dbError(message: string): FormState {
  if (message.includes("player_seasons_shirt_unique")) return { error: "Ce numéro de maillot est déjà attribué cette saison.", fieldErrors: { shirt_number: "Numéro déjà utilisé" } };
  if (message.includes("players_licence_unique")) return { error: "Ce numéro de licence existe déjà.", fieldErrors: { licence_number: "Licence déjà enregistrée" } };
  return { error: "L'enregistrement a échoué. Vérifiez vos droits et réessayez." };
}

async function uploadPhoto(clubId: string, playerId: string, file: File | null) {
  if (!file || file.size === 0) return { path: null as string | null };
  if (file.size > MAX_PHOTO) return { error: "Photo trop lourde (5 Mo maximum)." };
  if (!PHOTO_TYPES.includes(file.type)) return { error: "Format de photo non accepté (PNG, JPEG ou WebP)." };
  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${clubId}/${playerId}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("player-photos").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Échec de l'envoi de la photo." };
  return { path };
}

async function syncPositions(clubId: string, playerId: string, primary: string | null, secondary: string[]) {
  const supabase = await createClient();
  await supabase.from("player_positions").delete().eq("player_id", playerId);
  const rows = [
    ...(primary ? [{ club_id: clubId, player_id: playerId, position_id: primary, is_primary: true }] : []),
    ...secondary.filter((p) => p !== primary).map((p) => ({ club_id: clubId, player_id: playerId, position_id: p, is_primary: false })),
  ];
  if (rows.length) {
    const { error } = await supabase.from("player_positions").insert(rows);
    if (error) return error.message;
  }
  return null;
}

async function syncSeason(ctx: AccessContext, playerId: string, shirt: number | null, role: string | null) {
  const supabase = await createClient();
  const club = await getClubHeader(ctx);
  if (!club.season || !club.defaultTeamId) return null;
  const { error } = await supabase.from("player_seasons").upsert(
    { club_id: ctx.clubId, player_id: playerId, season_id: club.season.id, team_id: club.defaultTeamId, shirt_number: shirt, tactical_role: role },
    { onConflict: "player_id,season_id,team_id" },
  );
  return error?.message ?? null;
}

export async function createPlayer(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("players.write");
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      club_id: ctx.clubId,
      first_name: v.first_name,
      last_name: v.last_name.toUpperCase(),
      birth_date: v.birth_date,
      nationality: v.nationality,
      height_cm: v.height_cm,
      preferred_foot: v.preferred_foot,
      joined_on: v.joined_on,
      admin_status: v.admin_status,
      licence_number: v.licence_number,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !player) return dbError(error?.message ?? "");

  const photo = await uploadPhoto(ctx.clubId, player.id, formData.get("photo") as File | null);
  if ("error" in photo && photo.error) {
    await supabase.from("players").delete().eq("id", player.id);
    return { error: photo.error, fieldErrors: { photo: photo.error } };
  }
  if (photo.path) await supabase.from("players").update({ photo_path: photo.path }).eq("id", player.id);

  const posErr = await syncPositions(ctx.clubId, player.id, v.primary_position, v.secondary_positions);
  const seasonErr = await syncSeason(ctx, player.id, v.shirt_number, v.tactical_role);
  if (posErr || seasonErr) {
    await supabase.from("players").delete().eq("id", player.id);
    return dbError(seasonErr ?? posErr ?? "");
  }

  revalidatePath("/effectif");
  redirect(`/effectif/${player.id}?ok=cree`);
}

export async function updatePlayer(playerId: string, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("players.write");
  if (!z.uuid().safeParse(playerId).success) return { error: "Fiche introuvable." };
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  const photo = await uploadPhoto(ctx.clubId, playerId, formData.get("photo") as File | null);
  if ("error" in photo && photo.error) return { error: photo.error, fieldErrors: { photo: photo.error } };

  const { data: previous } = await supabase.from("players").select("photo_path").eq("id", playerId).single();
  const { data: updated, error } = await supabase
    .from("players")
    .update({
      first_name: v.first_name,
      last_name: v.last_name.toUpperCase(),
      birth_date: v.birth_date,
      nationality: v.nationality,
      height_cm: v.height_cm,
      preferred_foot: v.preferred_foot,
      joined_on: v.joined_on,
      admin_status: v.admin_status,
      licence_number: v.licence_number,
      ...(photo.path ? { photo_path: photo.path } : {}),
    })
    .eq("id", playerId)
    .select("id");
  if (error) return dbError(error.message);
  if (!updated?.length) return { error: "Modification refusée ou fiche introuvable." };
  if (photo.path && previous?.photo_path) await supabase.storage.from("player-photos").remove([previous.photo_path]);

  const err = (await syncSeason(ctx, playerId, v.shirt_number, v.tactical_role)) ?? (await syncPositions(ctx.clubId, playerId, v.primary_position, v.secondary_positions));
  if (err) return dbError(err);

  revalidatePath("/effectif");
  revalidatePath(`/effectif/${playerId}`);
  redirect(`/effectif/${playerId}?ok=modifie`);
}

export async function archivePlayer(playerId: string, archive: boolean) {
  await requirePermission("players.delete");
  const supabase = await createClient();
  await supabase.from("players").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", playerId);
  revalidatePath("/effectif");
  revalidatePath(`/effectif/${playerId}`);
}

// ------------------------------------------------------------ Disponibilité
const availabilitySchema = z
  .object({
    player_id: z.uuid("Joueuse requise"),
    status: z.enum(["disponible", "incertaine", "restreinte", "indisponible"]),
    reason: z.preprocess(emptyToNull, z.enum(["blessure", "maladie", "suspension", "selection_nationale", "raison_personnelle", "administratif", "scolaire_professionnel", "autre"]).nullable()),
    starts_on: z.iso.date("Date invalide"),
    expected_end_on: optDate,
    sporting_note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  })
  .refine((v) => v.status === "disponible" || v.reason, { message: "Motif requis", path: ["reason"] })
  .refine((v) => !v.expected_end_on || v.expected_end_on >= v.starts_on, { message: "Doit suivre la date de début", path: ["expected_end_on"] });

export async function declareAvailability(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("availability.write");
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  // Clôture la déclaration en cours la veille de la nouvelle.
  const dayBefore = new Date(`${v.starts_on}T12:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const { data: open } = await supabase
    .from("player_availability")
    .select("id, starts_on")
    .eq("player_id", v.player_id)
    .is("ended_on", null);
  for (const o of open ?? []) {
    const end = o.starts_on > dayBefore.toISOString().slice(0, 10) ? o.starts_on : dayBefore.toISOString().slice(0, 10);
    await supabase.from("player_availability").update({ ended_on: end }).eq("id", o.id);
  }
  const { error } = await supabase.from("player_availability").insert({
    club_id: ctx.clubId,
    player_id: v.player_id,
    status: v.status,
    reason: v.status === "disponible" ? null : v.reason,
    starts_on: v.starts_on,
    expected_end_on: v.expected_end_on,
    sporting_note: v.sporting_note,
    created_by: ctx.userId,
  });
  if (error) return { error: "Déclaration refusée. Vérifiez vos droits." };
  revalidatePath("/disponibilites");
  revalidatePath(`/effectif/${v.player_id}`);
  revalidatePath("/tableau-de-bord");
  return { ok: "Disponibilité enregistrée." };
}

// ------------------------------------------------------------ Documents
const DOC_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const docSchema = z.object({
  player_id: z.uuid(),
  kind: z.enum(["licence", "piece_identite", "certificat_aptitude", "autorisation_parentale", "contrat", "consentement_image", "autre"]),
  title: z.string().trim().min(2, "Titre requis").max(120),
  expires_on: optDate,
});

export async function uploadDocument(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("players.documents.write");
  const parsed = docSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Fichier requis.", fieldErrors: { file: "Fichier requis" } };
  if (file.size > 15 * 1024 * 1024) return { error: "Fichier trop lourd (15 Mo maximum)." };
  if (!DOC_TYPES.includes(file.type)) return { error: "Format non accepté (PDF, PNG ou JPEG)." };
  const v = parsed.data;
  const supabase = await createClient();
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${ctx.clubId}/${v.player_id}/${v.kind}-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("player-documents").upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Échec de l'envoi du fichier." };
  const { error } = await supabase.from("player_documents").insert({
    club_id: ctx.clubId, player_id: v.player_id, kind: v.kind, title: v.title, expires_on: v.expires_on, storage_path: path, uploaded_by: ctx.userId,
  });
  if (error) {
    await supabase.storage.from("player-documents").remove([path]);
    return { error: "Enregistrement du document refusé." };
  }
  revalidatePath(`/effectif/${v.player_id}`);
  revalidatePath("/documents");
  return { ok: "Document ajouté." };
}

export async function deleteDocument(documentId: string) {
  await requirePermission("players.documents.write");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("player_documents").select("storage_path, player_id").eq("id", documentId).single();
  if (!doc) return;
  await supabase.from("player_documents").delete().eq("id", documentId);
  await supabase.storage.from("player-documents").remove([doc.storage_path]);
  revalidatePath(`/effectif/${doc.player_id}`);
  revalidatePath("/documents");
}

/** Lien de téléchargement temporaire (5 minutes) généré à la demande. */
export async function documentLink(documentId: string): Promise<string | null> {
  await requirePermission("players.documents.read");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("player_documents").select("storage_path").eq("id", documentId).single();
  if (!doc) return null;
  const { data } = await supabase.storage.from("player-documents").createSignedUrl(doc.storage_path, 300);
  return data?.signedUrl ?? null;
}
