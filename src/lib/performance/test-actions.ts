"use server";

/**
 * Actions serveur des tests techniques (§21). Écritures sous la session de l'utilisateur :
 * RLS, versionnage des protocoles, copie du protocole dans chaque résultat, circuit de
 * validation et verrouillage sont appliqués par la base.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";

type R = { error?: string };
const uuid = z.uuid();
const optText = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable();
const nullable = (v: unknown) => (v === "" || v == null ? null : v);

function touch(id?: string) {
  revalidatePath("/performance", "layout");
  revalidatePath("/tableau-de-bord");
  if (id) revalidatePath(`/performance/tests/${id}`);
}

// ----------------------------------------------------------------- Séances de tests
const sessionSchema = z.object({
  tested_on: z.iso.date("Date requise"),
  title: z.string().trim().min(2, "Titre requis").max(160),
  location: z.preprocess((v) => v ?? "", optText(160)),
  conditions: z.preprocess((v) => v ?? "", optText(1000)),
  training_session_id: z.preprocess(nullable, uuid.nullable()),
});

export type TestCreateState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createTestSession(_: TestCreateState, form: FormData): Promise<TestCreateState> {
  const ctx = await requirePermission("evaluations.write");
  const parsed = sessionSchema.safeParse(Object.fromEntries(form.entries()));
  const protocolIds = form.getAll("protocol_ids").map(String).filter((v) => uuid.safeParse(v).success);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Certains champs sont invalides.", fieldErrors: fe };
  }
  if (!protocolIds.length) return { error: "Choisissez au moins un protocole.", fieldErrors: { protocol_ids: "Au moins un protocole" } };
  const supabase = await createClient();
  const scope = await getScope(ctx);
  const { data, error } = await supabase
    .from("technical_test_sessions")
    .insert({ club_id: ctx.clubId, season_id: scope.seasonId, ...parsed.data, protocol_ids: protocolIds.slice(0, 12) })
    .select("id")
    .single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch();
  redirect(`/performance/tests/${data.id}?nouvelle=1`);
}

export async function updateTestSession(id: string, patch: { title?: string; tested_on?: string; location?: string | null; conditions?: string | null; notes?: string | null; protocol_ids?: string[]; player_ids?: string[] }): Promise<R> {
  await requirePermission("evaluations.write");
  const s = z.object({
    title: z.string().trim().min(2, "Titre requis").max(160).optional(),
    tested_on: z.iso.date().optional(),
    location: optText(160).optional(),
    conditions: optText(1000).optional(),
    notes: optText(2000).optional(),
    protocol_ids: z.array(uuid).min(1, "Au moins un protocole").max(12).optional(),
    player_ids: z.array(uuid).max(60).optional(),
  }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("technical_test_sessions").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch(id);
  return {};
}

export async function setTestSessionStatus(id: string, to: string): Promise<R> {
  await requireStaff();
  const st = z.enum(["brouillon", "soumis", "valide", "publie", "archive"]).safeParse(to);
  if (!uuid.safeParse(id).success || !st.success) return { error: "Action invalide." };
  const supabase = await createClient();
  if (["soumis", "valide", "publie"].includes(st.data)) {
    const { data: rows } = await supabase.from("technical_test_results").select("index_value, successes, value_seconds").eq("test_session_id", id);
    if (!rows?.some((r) => r.successes != null || r.value_seconds != null)) return { error: "Aucun résultat saisi : renseignez au moins un test avant de soumettre." };
  }
  const { data, error } = await supabase.from("technical_test_sessions").update({ status: st.data }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Changement de statut refusé pour votre rôle.") };
  touch(id);
  return {};
}

export async function deleteTestSession(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("technical_test_sessions").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée (séance validée ?).") };
  touch();
  redirect("/performance/tests");
}

/** Résultat d'une joueuse pour un protocole (une ligne). Valeurs vides = effacer. */
export async function saveTestResults(sessionId: string, rows: { protocolId: string; playerId: string; attempts?: number | null; successes?: number | null; errors?: number | null; valueSeconds?: number | null; notes?: string | null }[]): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  const count = z.number().int().min(0, "Minimum 0").max(100, "Maximum 100").nullable().optional();
  const s = z.array(z.object({
    protocolId: uuid, playerId: uuid,
    attempts: z.number().int().min(1, "Au moins 1 tentative").max(100, "Maximum 100").nullable().optional(),
    successes: count, errors: count,
    valueSeconds: z.number().positive("Temps positif").max(3599).nullable().optional(),
    notes: optText(500).optional(),
  }).refine((r) => r.successes == null || r.attempts == null || r.successes <= r.attempts, { message: "Plus de réussites que de tentatives." })
    .refine((r) => r.errors == null || r.attempts == null || r.errors <= r.attempts, { message: "Plus d'erreurs que de tentatives." }))
    .min(1).max(200).safeParse(rows);
  if (!uuid.safeParse(sessionId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("technical_test_results").select("protocol_id, player_id, attempts, successes, errors, value_seconds, notes").eq("test_session_id", sessionId);
  const prev = new Map((existing ?? []).map((e) => [`${e.protocol_id}|${e.player_id}`, e]));
  const pick = <T,>(v: T | undefined, p: T | null | undefined) => (v !== undefined ? v : p ?? null);
  const payload = s.data.map((r) => {
    const p = prev.get(`${r.protocolId}|${r.playerId}`);
    return {
      club_id: ctx.clubId, test_session_id: sessionId, protocol_id: r.protocolId, player_id: r.playerId,
      attempts: pick(r.attempts, p?.attempts), successes: pick(r.successes, p?.successes), errors: pick(r.errors, p?.errors),
      value_seconds: pick(r.valueSeconds, p?.value_seconds == null ? null : Number(p.value_seconds)), notes: pick(r.notes, p?.notes),
    };
  });
  const { error } = await supabase.from("technical_test_results").upsert(payload, { onConflict: "test_session_id,protocol_id,player_id" });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  return {};
}

export async function refreshTests(id: string) {
  touch(id);
}

// ----------------------------------------------------------------- Protocoles
const protocolSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120).optional(),
  objective: optText(500).optional(),
  setup: z.string().trim().min(5, "Décrivez les conditions").max(2000).optional(),
  attempts: z.number().int().min(1).max(100).optional(),
  ref_best: z.number().positive().max(3599).nullable().optional(),
  ref_limit: z.number().positive().max(3599).nullable().optional(),
  criterion_codes: z.array(z.string().regex(/^[a-z0-9_]{2,60}$/)).max(10).optional(),
  active: z.boolean().optional(),
});

export async function updateProtocol(id: string, patch: z.input<typeof protocolSchema>): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = protocolSchema.safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  if ((s.data.ref_best === null) !== (s.data.ref_limit === null) || (s.data.ref_best != null && s.data.ref_limit != null && s.data.ref_best >= s.data.ref_limit)) {
    return { error: "Barème : le temps de référence (100) doit être inférieur au temps limite (0)." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("technical_test_protocols").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return {};
}
