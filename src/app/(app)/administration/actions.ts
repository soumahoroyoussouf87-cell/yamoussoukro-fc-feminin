"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { FormState } from "@/app/(app)/effectif/actions";

const inviteSchema = z.object({
  email: z.email("E-mail invalide").transform((v) => v.toLowerCase().trim()),
  full_name: z.string().trim().min(2, "Nom requis").max(120),
  role_id: z.uuid("Rôle requis"),
  player_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
});

/**
 * Invite (ou retrouve) un compte puis lui attribue un rôle.
 * La clé service_role n'est utilisée QUE pour l'appel d'invitation Auth, après
 * vérification de « users.manage ». L'attribution du rôle passe par le client
 * de l'administrateur : elle est donc contrôlée par la RLS et historisée.
 */
export async function inviteUser(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("users.manage");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Certains champs sont invalides.", fieldErrors: fe };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("code").eq("id", v.role_id).single();
  if (!role) return { error: "Rôle introuvable." };
  if (role.code === "player" && !v.player_id) return { error: "Choisissez la fiche joueuse à relier.", fieldErrors: { player_id: "Fiche requise" } };

  const admin = createAdminClient();
  let userId: string | null = null;
  const { data: existing } = await admin.from("profiles").select("id").eq("email", v.email).maybeSingle();
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(v.email, {
      data: { full_name: v.full_name },
      redirectTo: `${env.siteUrl}/auth/confirm?next=/definir-mot-de-passe`,
    });
    if (error || !data.user) return { error: "L'invitation n'a pas pu être envoyée (service e-mail ou adresse invalide)." };
    userId = data.user.id;
  }
  if (userId === ctx.userId) return { error: "Vous ne pouvez pas vous attribuer un rôle à vous-même." };

  const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, club_id: ctx.clubId, role_id: v.role_id });
  if (roleErr) return { error: roleErr.code === "23505" ? "Ce compte a déjà ce rôle." : "Attribution du rôle refusée." };

  if (role.code === "player" && v.player_id) {
    const { error } = await supabase.from("players").update({ profile_id: userId }).eq("id", v.player_id);
    if (error) return { error: "Rôle attribué, mais la fiche joueuse n'a pas pu être reliée (déjà reliée à un autre compte ?)." };
  }
  revalidatePath("/administration/utilisateurs");
  return { ok: existing ? "Rôle attribué au compte existant." : `Invitation envoyée à ${v.email}.` };
}

export async function revokeRole(userRoleId: string): Promise<{ error?: string }> {
  await requirePermission("users.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").update({ revoked_at: new Date().toISOString() }).eq("id", userRoleId);
  revalidatePath("/administration/utilisateurs");
  return error ? { error: error.message.includes("dernier administrateur") ? "Impossible de retirer le dernier administrateur." : "Révocation refusée." } : {};
}

// ------------------------------------------------------------------ Paramètres
export async function updateClub(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    short_name: z.string().trim().max(40),
    city: z.string().trim().max(80),
    min_observations_for_index: z.coerce.number().int().min(1).max(50),
  });
  const p = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!p.success) return { error: "Valeurs invalides." };
  const supabase = await createClient();
  const { error } = await supabase.from("clubs").update({ name: p.data.name, short_name: p.data.short_name || null, city: p.data.city || null }).eq("id", ctx.clubId);
  const { error: e2 } = await supabase.from("application_settings").update({ min_observations_for_index: p.data.min_observations_for_index }).eq("club_id", ctx.clubId);
  revalidatePath("/", "layout");
  return error || e2 ? { error: "Enregistrement refusé." } : { ok: "Paramètres enregistrés." };
}

export async function createSeason(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const p = z
    .object({ label: z.string().trim().regex(/^\d{4}-\d{4}$/, "Format attendu : 2026-2027"), starts_on: z.iso.date(), ends_on: z.iso.date(), activate: z.string().optional() })
    .refine((v) => v.ends_on > v.starts_on, { message: "La fin doit suivre le début", path: ["ends_on"] })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("seasons").insert({ club_id: ctx.clubId, label: p.data.label, starts_on: p.data.starts_on, ends_on: p.data.ends_on }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "Cette saison existe déjà." : "Création refusée." };
  if (p.data.activate) await activateSeason(data.id);
  revalidatePath("/", "layout");
  return { ok: "Saison créée." };
}

export async function activateSeason(seasonId: string) {
  const ctx = await requirePermission("settings.manage");
  const supabase = await createClient();
  await supabase.from("seasons").update({ is_active: false }).eq("club_id", ctx.clubId).eq("is_active", true);
  await supabase.from("seasons").update({ is_active: true }).eq("id", seasonId);
  await supabase.from("application_settings").update({ active_season_id: seasonId, active_competition_id: null }).eq("club_id", ctx.clubId);
  revalidatePath("/", "layout");
}

export async function createCompetition(_: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const p = z
    .object({
      season_id: z.uuid("Saison requise"),
      team_id: z.uuid("Équipe requise"),
      name: z.string().trim().min(2, "Nom requis").max(120),
      type: z.enum(["championnat", "coupe", "amical", "tournoi", "autre"]),
      squad_size_limit: z.coerce.number().int().min(11).max(40),
      activate: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!p.success) return { error: p.error.issues[0].message };
  const { activate, ...row } = p.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("competitions").insert({ ...row, club_id: ctx.clubId, is_primary: !!activate }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "Cette compétition existe déjà pour la saison." : "Création refusée." };
  if (activate) await supabase.from("application_settings").update({ active_competition_id: data.id }).eq("club_id", ctx.clubId);
  revalidatePath("/", "layout");
  return { ok: "Compétition créée." };
}

export async function activateCompetition(competitionId: string) {
  const ctx = await requirePermission("settings.manage");
  const supabase = await createClient();
  await supabase.from("application_settings").update({ active_competition_id: competitionId }).eq("club_id", ctx.clubId);
  revalidatePath("/", "layout");
}
