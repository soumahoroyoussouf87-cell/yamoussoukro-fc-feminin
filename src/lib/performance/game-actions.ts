"use server";

/**
 * Actions serveur du projet de jeu, des systèmes et des évaluations collectives.
 * Figement des versions publiées, cohérence, circuit de validation et verrouillage : appliqués par la base.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";
import { LINE_RELATIONS, MOMENTS, RELATION_CRITERIA, RELATIONS, SECTOR_CRITERIA, SECTORS, SITUATIONS, SYSTEM_PHASES } from "./collective";

type R = { error?: string };
const uuid = z.uuid();
const optText = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable();
const nullable = (v: unknown) => (v === "" || v == null ? null : v);

function touch() {
  revalidatePath("/projet-de-jeu", "layout");
  revalidatePath("/performance", "layout");
  revalidatePath("/tableau-de-bord");
}

function slug(label: string, prefix = "") {
  const s = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
  return `${prefix}${s || "principe"}`;
}

// ----------------------------------------------------------------- Versions du projet de jeu
export async function createGameDraft(fromVersionId: string, label: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(fromVersionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clone_game_model_version", { p_version: fromVersionId, p_label: label.slice(0, 120) });
  if (error || !data) return { error: error?.code === "23505" ? "Un brouillon existe déjà : terminez-le ou supprimez-le." : dbError(error, "Création refusée.") };
  touch();
  redirect(`/projet-de-jeu/versions/${data}`);
}

export async function updateGameDraft(versionId: string, patch: { label?: string; notes?: string | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = z.object({ label: z.string().trim().min(2, "Nom requis").max(120).optional(), notes: optText(2000).optional() }).safeParse(patch);
  if (!uuid.safeParse(versionId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_model_versions").update(s.data).eq("id", versionId).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return {};
}

export async function publishGameVersion(versionId: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(versionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_game_model_version", { p_version: versionId });
  if (error) return { error: error.code === "23514" ? error.message : dbError(error, "Publication refusée.") };
  touch();
  return {};
}

export async function deleteGameDraft(versionId: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(versionId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_model_versions").delete().eq("id", versionId).eq("status", "brouillon").select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  redirect("/projet-de-jeu");
}

export async function updateMoment(id: string, patch: { weight?: number; description?: string | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = z.object({ weight: z.number().min(0, "0 à 100").max(100, "0 à 100").optional(), description: optText(2000).optional() }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_moments").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  return {};
}

export async function addPrinciple(versionId: string, moment: string, label: string): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.object({ versionId: uuid, moment: z.enum(MOMENTS.map((m) => m.code) as [string, ...string[]]), label: z.string().trim().min(2, "Libellé requis").max(120) }).safeParse({ versionId, moment, label });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data: m } = await supabase.from("game_moments").select("id").eq("version_id", versionId).eq("code", s.data.moment).maybeSingle();
  if (!m) return { error: "Moment introuvable." };
  const prefix = { organisation_offensive: "oo_", organisation_defensive: "od_", transition_offensive: "to_", transition_defensive: "td_", cpa: "cpa_" }[s.data.moment] ?? "";
  let code = slug(s.data.label, prefix);
  const { data: clash } = await supabase.from("game_principles").select("code").eq("version_id", versionId).like("code", `${code}%`);
  if (clash?.some((c) => c.code === code)) code = `${code}_${(clash?.length ?? 0) + 1}`;
  const { data: last } = await supabase.from("game_principles").select("sort_order").eq("version_id", versionId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("game_principles").insert({ club_id: ctx.clubId, version_id: versionId, moment_id: m.id, code, label: s.data.label, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touch();
  return {};
}

export async function updatePrinciple(id: string, patch: { label?: string; description?: string | null; expected_behaviors?: string | null; evaluation_criteria?: string | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = z.object({
    label: z.string().trim().min(2, "Libellé requis").max(120).optional(), description: optText(2000).optional(),
    expected_behaviors: optText(3000).optional(), evaluation_criteria: optText(3000).optional(),
  }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_principles").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  return {};
}

export async function deletePrinciple(id: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_principles").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  return {};
}

export async function addSubprinciple(principleId: string, label: string): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.string().trim().min(2, "Libellé requis").max(160).safeParse(label);
  if (!uuid.safeParse(principleId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data: p } = await supabase.from("game_principles").select("version_id").eq("id", principleId).maybeSingle();
  if (!p) return { error: "Principe introuvable." };
  const { error } = await supabase.from("game_subprinciples").insert({ club_id: ctx.clubId, version_id: p.version_id, principle_id: principleId, label: s.data, sort_order: Date.now() % 30000 });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touch();
  return {};
}

export async function deleteSubprinciple(id: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_subprinciples").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  return {};
}

export async function linkExercise(principleId: string, exerciseId: string): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  if (!uuid.safeParse(principleId).success || !uuid.safeParse(exerciseId).success) return { error: "Choisissez un exercice." };
  const supabase = await createClient();
  const { data: p } = await supabase.from("game_principles").select("version_id").eq("id", principleId).maybeSingle();
  if (!p) return { error: "Principe introuvable." };
  const { error } = await supabase.from("game_principle_exercises").upsert({ club_id: ctx.clubId, version_id: p.version_id, principle_id: principleId, exercise_id: exerciseId }, { onConflict: "principle_id,exercise_id", ignoreDuplicates: true });
  if (error) return { error: dbError(error, "Lien refusé.") };
  touch();
  return {};
}

export async function unlinkExercise(principleId: string, exerciseId: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(principleId).success || !uuid.safeParse(exerciseId).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { error } = await supabase.from("game_principle_exercises").delete().eq("principle_id", principleId).eq("exercise_id", exerciseId);
  if (error) return { error: dbError(error, "Suppression refusée.") };
  touch();
  return {};
}

// ----------------------------------------------------------------- Compacité
export async function setCompactnessTarget(situation: string, relation: string, min: number | null, max: number | null): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  const s = z.object({
    situation: z.enum(SITUATIONS.map((x) => x.code) as [string, ...string[]]), relation: z.enum(LINE_RELATIONS),
    min: z.number().positive().max(99).nullable(), max: z.number().positive().max(99).nullable(),
  }).safeParse({ situation, relation, min, max });
  if (!s.success) return { error: "Distances invalides (en mètres)." };
  const supabase = await createClient();
  if (s.data.min == null || s.data.max == null) {
    const { error } = await supabase.from("compactness_targets").delete().eq("club_id", ctx.clubId).eq("situation", situation).eq("relation_code", relation);
    if (error) return { error: dbError(error, "Suppression refusée.") };
  } else {
    if (s.data.min > s.data.max) return { error: "La distance minimale doit être inférieure à la maximale." };
    const { error } = await supabase.from("compactness_targets").upsert(
      { club_id: ctx.clubId, situation, relation_code: relation, min_m: s.data.min, max_m: s.data.max }, { onConflict: "club_id,situation,relation_code" });
    if (error) return { error: dbError(error, "Enregistrement refusé.") };
  }
  touch();
  return {};
}

// ----------------------------------------------------------------- Systèmes
const slotSchema = z.array(z.object({ label: z.string().trim().min(1).max(6), x: z.number().min(0).max(100), y: z.number().min(0).max(100) })).min(1).max(11);
const systemSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(80),
  base: z.string().trim().min(2).max(40),
  phase: z.enum(SYSTEM_PHASES.map((p) => p.code) as [string, ...string[]]),
  parent_id: z.preprocess(nullable, uuid.nullable()),
  slots: slotSchema,
  notes: z.preprocess((v) => v ?? "", optText(2000)),
});

export async function createSystem(input: z.input<typeof systemSchema>): Promise<R & { id?: string }> {
  const ctx = await requirePermission("frameworks.manage");
  const s = systemSchema.safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  if ((s.data.phase === "reference") !== (s.data.parent_id == null)) return { error: "Une animation se rattache à un système de référence." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_systems").insert({ club_id: ctx.clubId, ...s.data }).select("id").single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch();
  return { id: data.id };
}

export async function updateSystem(id: string, patch: { name?: string; slots?: { label: string; x: number; y: number }[]; notes?: string | null }): Promise<R> {
  await requirePermission("frameworks.manage");
  const s = z.object({ name: z.string().trim().min(2, "Nom requis").max(80).optional(), slots: slotSchema.optional(), notes: optText(2000).optional() }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_systems").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return {};
}

export async function deleteSystem(id: string): Promise<R> {
  await requirePermission("frameworks.manage");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_systems").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  return {};
}

export async function setReferenceSystem(id: string): Promise<R> {
  const ctx = await requirePermission("frameworks.manage");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  await supabase.from("game_systems").update({ is_reference: false }).eq("club_id", ctx.clubId).eq("is_reference", true);
  const { data, error } = await supabase.from("game_systems").update({ is_reference: true }).eq("id", id).is("parent_id", null).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return {};
}

// ----------------------------------------------------------------- Évaluations collectives
const evalSchema = z.object({
  context: z.enum(["match", "entrainement"]),
  evaluated_on: z.iso.date("Date requise"),
  title: z.string().trim().min(2, "Titre requis").max(160),
  match_id: z.preprocess(nullable, uuid.nullable()),
  training_session_id: z.preprocess(nullable, uuid.nullable()),
  system_id: z.preprocess(nullable, uuid.nullable()),
  notes: z.preprocess((v) => v ?? "", optText(2000)),
});
export type CollCreateState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createCollectiveEvaluation(_: CollCreateState, form: FormData): Promise<CollCreateState> {
  const ctx = await requirePermission("evaluations.write");
  const parsed = evalSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Certains champs sont invalides.", fieldErrors: fe };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const [{ data: gv }, scope] = await Promise.all([
    supabase.from("game_model_versions").select("id").eq("club_id", ctx.clubId).eq("status", "publie").maybeSingle(),
    getScope(ctx),
  ]);
  if (!gv) return { error: "Aucun projet de jeu publié." };
  const { data, error } = await supabase.from("collective_evaluations").insert({
    club_id: ctx.clubId, season_id: scope.seasonId, game_model_version_id: gv.id, context: v.context, evaluated_on: v.evaluated_on,
    title: v.title, match_id: v.context === "match" ? v.match_id : null, training_session_id: v.context === "entrainement" ? v.training_session_id : null,
    system_id: v.system_id, notes: v.notes,
  }).select("id").single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch();
  redirect(`/performance/collective/${data.id}?nouvelle=1`);
}

export async function updateCollectiveEvaluation(id: string, patch: { title?: string; evaluated_on?: string; notes?: string | null; system_id?: string | null }): Promise<R> {
  await requirePermission("evaluations.write");
  const s = z.object({ title: z.string().trim().min(2, "Titre requis").max(160).optional(), evaluated_on: z.iso.date().optional(), notes: optText(2000).optional(), system_id: uuid.nullable().optional() }).safeParse(patch);
  if (!uuid.safeParse(id).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("collective_evaluations").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return {};
}

export async function setCollectiveStatus(id: string, to: string): Promise<R> {
  await requireStaff();
  const st = z.enum(["brouillon", "soumis", "valide", "publie", "archive"]).safeParse(to);
  if (!uuid.safeParse(id).success || !st.success) return { error: "Action invalide." };
  const supabase = await createClient();
  if (["soumis", "valide", "publie"].includes(st.data)) {
    const { count } = await supabase.from("collective_scores").select("id", { count: "exact", head: true }).eq("collective_evaluation_id", id).not("score", "is", null);
    if (!count) return { error: "Aucune note saisie : évaluez au moins un principe, un secteur ou une relation avant de soumettre." };
  }
  const { data, error } = await supabase.from("collective_evaluations").update({ status: st.data }).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Changement de statut refusé pour votre rôle.") };
  touch();
  return {};
}

export async function deleteCollectiveEvaluation(id: string): Promise<R> {
  await requirePermission("evaluations.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("collective_evaluations").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée (évaluation validée ?).") };
  touch();
  redirect("/performance/collective");
}

const scoreRow = z.object({
  kind: z.enum(["principe", "secteur", "relation"]),
  unit: z.string().regex(/^[a-z0-9_]{2,60}$/),
  criterion: z.string().regex(/^[a-z0-9_]{2,60}$/),
  score: z.number().int().min(1).max(5).nullable().optional(),
  fact: optText(1000).optional(),
  interpretation: optText(1000).optional(),
}).refine((r) => r.kind !== "secteur" || (SECTORS.some((s) => s.code === r.unit) && SECTOR_CRITERIA.some((c) => c.code === r.criterion)), "Secteur inconnu.")
  .refine((r) => r.kind !== "relation" || (RELATIONS.some((s) => s.code === r.unit) && RELATION_CRITERIA.some((c) => c.code === r.criterion)), "Relation inconnue.")
  .refine((r) => r.kind !== "principe" || r.criterion === "maitrise", "Critère invalide.");

export async function saveCollectiveScores(evaluationId: string, rows: z.input<typeof scoreRow>[]): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  const s = z.array(scoreRow).min(1).max(200).safeParse(rows);
  if (!uuid.safeParse(evaluationId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("collective_scores").select("unit_kind, unit_code, criterion_code, score, fact, interpretation").eq("collective_evaluation_id", evaluationId);
  const prev = new Map((existing ?? []).map((e) => [`${e.unit_kind}|${e.unit_code}|${e.criterion_code}`, e]));
  const payload = s.data.map((r) => {
    const p = prev.get(`${r.kind}|${r.unit}|${r.criterion}`);
    return {
      club_id: ctx.clubId, collective_evaluation_id: evaluationId, unit_kind: r.kind, unit_code: r.unit, criterion_code: r.criterion,
      score: r.score !== undefined ? r.score : p?.score ?? null,
      fact: r.fact !== undefined ? r.fact : p?.fact ?? null,
      interpretation: r.interpretation !== undefined ? r.interpretation : p?.interpretation ?? null,
    };
  });
  const { error } = await supabase.from("collective_scores").upsert(payload, { onConflict: "collective_evaluation_id,unit_kind,unit_code,criterion_code" });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  return {};
}

/** Distance entre deux lignes (null = supprimer la mesure). */
export async function saveMeasure(evaluationId: string, relation: string, situation: string, distance: number | null, note?: string | null): Promise<R> {
  const ctx = await requirePermission("evaluations.write");
  const s = z.object({
    relation: z.enum(LINE_RELATIONS), situation: z.enum(SITUATIONS.map((x) => x.code) as [string, ...string[]]),
    distance: z.number().positive("Distance positive").max(99).nullable(), note: optText(500).optional(),
  }).safeParse({ relation, situation, distance, note });
  if (!uuid.safeParse(evaluationId).success || !s.success) return { error: s.success ? "Action invalide." : s.error.issues[0].message };
  const supabase = await createClient();
  const { error } = s.data.distance == null
    ? await supabase.from("collective_measures").delete().eq("collective_evaluation_id", evaluationId).eq("relation_code", relation).eq("situation", situation)
    : await supabase.from("collective_measures").upsert({
      club_id: ctx.clubId, collective_evaluation_id: evaluationId, relation_code: relation, situation, distance_m: s.data.distance,
      ...(s.data.note !== undefined ? { note: s.data.note } : {}),
    }, { onConflict: "collective_evaluation_id,relation_code,situation" });
  if (error) return { error: dbError(error, "Enregistrement refusé.") };
  return {};
}

export async function refreshCollective() {
  touch();
}
