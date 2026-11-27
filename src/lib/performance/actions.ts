"use server";

/**
 * Actions serveur du Performance Framework. Les écritures passent par la session
 * de l'utilisateur : RLS, figement des référentiels publiés, circuit de validation
 * et verrouillage des évaluations validées sont appliqués par la base.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";
import { DIMENSION_CODES, FRAMEWORK_KEYS } from "./engine";

type R = { error?: string };
const uuid = z.uuid();
const fk = z.enum(FRAMEWORK_KEYS);
const dim = z.enum(DIMENSION_CODES as [string, ...string[]]);
const optText = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable();

function touchPerformance() {
  revalidatePath("/performance", "layout");
  revalidatePath("/tableau-de-bord");
}

// ----------------------------------------------------------------- Séances d'évaluation
const sessionSchema = z.object({
  context: z.enum(["match", "entrainement"]),
  evaluated_on: z.iso.date("Date requise"),
  title: z.string().trim().min(2, "Titre requis").max(160),
  match_id: z.preprocess((v) => (v === "" || v == null ? null : v), uuid.nullable()),
  training_session_id: z.preprocess((v) => (v === "" || v == null ? null : v), uuid.nullable()),
  notes: z.preprocess((v) => (v ?? ""), optText(2000)),
});

export type CreateState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createEvaluationSession(_: CreateState, form: FormData): Promise<CreateState> {
  const ctx = await requirePermission("evaluations.write");
  const parsed = sessionSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Certains champs sont invalides.", fieldErrors: fe };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const [{ data: fw }, scope] = await Promise.all([
    supabase.from("framework_versions").select("id, evaluation_frameworks!inner(kind)").eq("club_id", ctx.clubId).eq("status", "publie").eq("evaluation_frameworks.kind", "individuel").maybeSingle(),
    getScope(ctx),
  ]);
  if (!fw) return { error: "Aucun référentiel publié : publiez d'abord un référentiel d'évaluation." };
  const { data, error } = await supabase
    .from("evaluation_sessions")
    .insert({
      club_id: ctx.clubId,
      season_id: scope.seasonId,
      framework_version_id: fw.id,
      context: v.context,
      evaluated_on: v.evaluated_on,
      title: v.title,
      match_id: v.context === "match" ? v.match_id : null,
      training_session_id: v.context === "entrainement" ? v.training_session_id : null,
      notes: v.notes,
    })
    .select("id")
    .single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touchPerformance();
  redirect(`/performance/evaluations/${data.id}?nouvelle=1`);
}

export async function updateEvaluationSession(id: string, patch: { title?: string; evaluated_on?: string; notes?: string | null }): Promise<R> {
  await requirePermission("evaluations.write");
  const s = z.object({ title: z.string().trim().min(2, "Titre requis").max(160).optional(), evaluated_on: z.iso.date().optional(), notes: optText(2000).optional() }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("evaluation_sessions").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touchPerformance();
  return {};
}

export async function setEvaluationStatus(id: string, to: string): Promise<R> {
  await requireStaff();
  const st = z.enum(["brouillon", "soumis", "valide", "publie", "archive"]).safeParse(to);
  if (!uuid.safeParse(id).success || !st.success) return { error: "Action invalide." };
  const supabase = await createClient();
  if (["soumis", "valide", "publie"].includes(st.data)) {
    const { count } = await supabase.from("evaluation_scores").select("id, individual_evaluations!inner(evaluation_session_id)", { count: "exact", head: true })
      .eq("individual_evaluations.evaluation_session_id", id).not("score", "is", null);
    if (!count) return { error: "Aucune note saisie : évaluez au moins une joueuse avant de soumettre." };
  }
  const { data, error } = await supabase.from("evaluation_sessions").update({ status: st.data }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Changement de statut refusé pour votre rôle.") };
  touchPerformance();
  return {};
}

export async function deleteEvaluationSession(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("evaluation_sessions").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée (évaluation validée ?).") };
  touchPerformance();
  redirect("/performance/evaluations");
}

// ----------------------------------------------------------------- Joueuses évaluées
export async function addPlayers(sessionId: string, players: { playerId: string; frameworkKey: string; positionId?: string | null; minutes?: number | null }[]): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  const s = z.array(z.object({ playerId: uuid, frameworkKey: fk, positionId: uuid.nullable().optional(), minutes: z.number().int().min(0).max(300).nullable().optional() })).min(1).max(40).safeParse(players);
  if (!uuid.safeParse(sessionId).success || !s.success) return { error: "Choisissez au moins une joueuse et son poste." };
  const supabase = await createClient();
  const { error } = await supabase.from("individual_evaluations").upsert(
    s.data.map((p) => ({ club_id: ctx.clubId, evaluation_session_id: sessionId, player_id: p.playerId, framework_key: p.frameworkKey, position_id: p.positionId ?? null, minutes_played: p.minutes ?? null })),
    { onConflict: "evaluation_session_id,player_id", ignoreDuplicates: true },
  );
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touchPerformance();
  return {};
}

export async function updateIndividual(id: string, patch: { framework_key?: string; position_id?: string | null; minutes_played?: number | null; comment?: string | null }): Promise<R> {
  await requirePermission("evaluations.write");
  const s = z.object({
    framework_key: fk.optional(),
    position_id: uuid.nullable().optional(),
    minutes_played: z.number().int().min(0, "Minimum 0").max(300, "Maximum 300").nullable().optional(),
    comment: optText(2000).optional(),
  }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("individual_evaluations").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Enregistrement refusé.") };
  touchPerformance();
  return {};
}

export async function removeIndividual(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("individual_evaluations").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touchPerformance();
  return {};
}

/** Note, fait observé et interprétation d'un critère (une ligne par critère). */
export async function saveScores(individualId: string, rows: { criterionId: string; score?: number | null; fact?: string | null; interpretation?: string | null }[]): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  const s = z.array(z.object({
    criterionId: uuid,
    score: z.number().int().min(1).max(5).nullable().optional(),
    fact: optText(1000).optional(),
    interpretation: optText(1000).optional(),
  })).min(1).max(120).safeParse(rows);
  if (!uuid.safeParse(individualId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  // Lignes existantes : on ne remplace que les champs transmis.
  const { data: existing } = await supabase.from("evaluation_scores").select("criterion_id, score, fact, interpretation").eq("individual_evaluation_id", individualId)
    .in("criterion_id", s.data.map((r) => r.criterionId));
  const prev = new Map((existing ?? []).map((e) => [e.criterion_id, e]));
  const payload = s.data.map((r) => {
    const p = prev.get(r.criterionId);
    return {
      club_id: ctx.clubId,
      individual_evaluation_id: individualId,
      criterion_id: r.criterionId,
      score: r.score !== undefined ? r.score : p?.score ?? null,
      fact: r.fact !== undefined ? r.fact : p?.fact ?? null,
      interpretation: r.interpretation !== undefined ? r.interpretation : p?.interpretation ?? null,
    };
  });
  const { error } = await supabase.from("evaluation_scores").upsert(payload, { onConflict: "individual_evaluation_id,criterion_id" });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  return {};
}

export async function refreshPerformance() {
  touchPerformance();
}

// ----------------------------------------------------------------- Référentiels
export async function createDraftVersion(fromVersionId: string, label: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(fromVersionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clone_framework_version", { p_version: fromVersionId, p_label: label.slice(0, 120) });
  if (error || !data) return { error: error?.code === "23505" ? "Un brouillon existe déjà : terminez-le ou supprimez-le." : dbError(error, "Création refusée.") };
  touchPerformance();
  redirect(`/performance/referentiels/${data}`);
}

export async function updateDraft(versionId: string, patch: { label?: string; notes?: string | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = z.object({ label: z.string().trim().min(2, "Nom requis").max(120).optional(), notes: optText(2000).optional() }).safeParse(patch);
  if (!uuid.safeParse(versionId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("framework_versions").update(s.data).eq("id", versionId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touchPerformance();
  return {};
}

export async function publishVersion(versionId: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(versionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_framework_version", { p_version: versionId });
  if (error) return { error: error.code === "23514" ? error.message : dbError(error, "Publication refusée.") };
  touchPerformance();
  return {};
}

export async function deleteDraft(versionId: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(versionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("framework_versions").delete().eq("id", versionId).eq("status", "brouillon").select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touchPerformance();
  redirect("/performance/referentiels");
}

const critSchema = z.object({
  label: z.string().trim().min(2, "Libellé requis").max(120).optional(),
  description: optText(1000).optional(),
  default_weight: z.number().min(0).max(100).nullable().optional(),
});

export async function updateCriterion(id: string, patch: { label?: string; description?: string | null; default_weight?: number | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = critSchema.safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("evaluation_criteria").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touchPerformance();
  return {};
}

function slug(label: string) {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50) || "critere";
}

export async function addCriterion(versionId: string, dimension: string, label: string): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.object({ versionId: uuid, dimension: dim, label: z.string().trim().min(2, "Libellé requis").max(120) }).safeParse({ versionId, dimension, label });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data: d } = await supabase.from("evaluation_dimensions").select("id").eq("version_id", versionId).eq("code", s.data.dimension).maybeSingle();
  if (!d) return { error: "Dimension introuvable." };
  const { data: last } = await supabase.from("evaluation_criteria").select("sort_order").eq("version_id", versionId).order("sort_order", { ascending: false }).limit(1);
  let code = slug(s.data.label);
  const { data: clash } = await supabase.from("evaluation_criteria").select("code").eq("version_id", versionId).like("code", `${code}%`);
  if (clash?.some((c) => c.code === code)) code = `${code}_${(clash?.length ?? 0) + 1}`;
  const { error } = await supabase.from("evaluation_criteria").insert({
    club_id: ctx.clubId, version_id: versionId, dimension_id: d.id, code, label: s.data.label,
    // Technique : pondéré poste par poste ; autres dimensions : poids égal pour tous les postes.
    default_weight: s.data.dimension === "technique" ? null : 1,
    sort_order: (last?.[0]?.sort_order ?? 0) + 1,
  });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touchPerformance();
  return {};
}

export async function deleteCriterion(id: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("evaluation_criteria").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touchPerformance();
  return {};
}

/** Poids d'un critère pour un poste (null = retirer la pondération explicite). */
export async function setCriterionWeight(versionId: string, criterionId: string, key: string, weight: number | null): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.object({ versionId: uuid, criterionId: uuid, key: fk, weight: z.number().min(0).max(100).nullable() }).safeParse({ versionId, criterionId, key, weight });
  if (!s.success) return { error: "Poids invalide (0 à 100)." };
  const supabase = await createClient();
  const { error } = s.data.weight == null
    ? await supabase.from("position_criteria_weights").delete().eq("criterion_id", criterionId).eq("framework_key", s.data.key)
    : await supabase.from("position_criteria_weights").upsert(
      { club_id: ctx.clubId, version_id: versionId, criterion_id: criterionId, framework_key: s.data.key, weight: s.data.weight },
      { onConflict: "criterion_id,framework_key" },
    );
  if (error) return { error: dbError(error, "Modification refusée.") };
  return {};
}

export async function setDimensionWeight(versionId: string, key: string, dimension: string, weight: number): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.object({ versionId: uuid, key: fk, dimension: dim, weight: z.number().min(0).max(100) }).safeParse({ versionId, key, dimension, weight });
  if (!s.success) return { error: "Poids invalide (0 à 100)." };
  const supabase = await createClient();
  const { error } = await supabase.from("position_dimension_weights").upsert(
    { club_id: ctx.clubId, version_id: versionId, framework_key: s.data.key, dimension_code: s.data.dimension, weight: s.data.weight },
    { onConflict: "version_id,framework_key,dimension_code" },
  );
  if (error) return { error: dbError(error, "Modification refusée.") };
  return {};
}

export async function setMinObservations(value: number): Promise<R> {
  const ctx = await requirePermission("settings.manage");
  const s = z.number().int().min(1).max(50).safeParse(value);
  if (!s.success) return { error: "Seuil entre 1 et 50." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("application_settings").update({ min_observations_for_index: s.data }).eq("club_id", ctx.clubId).select("club_id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touchPerformance();
  return {};
}
