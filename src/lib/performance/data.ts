import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getScope, listPlayerOptions, type PlayerOption } from "@/lib/phase2/data";
import {
  aggregatePlayer, DIMENSION_CODES, POSITION_FRAMEWORK_KEY, type Context, type DimensionCode, type FrameworkKey,
  type Observation, type PlayerIndices, type VersionModel,
} from "./engine";

export type DimensionMeta = { id: string; code: DimensionCode; label: string; description: string | null; sortOrder: number };
export type VersionFull = VersionModel & {
  status: "brouillon" | "publie" | "archive";
  notes: string | null;
  publishedAt: string | null;
  frameworkId: string;
  dimensions: DimensionMeta[];
};

export const VALIDATED = ["valide", "publie"] as const;

/** Référentiel complet d'une version (critères, pondérations). */
export async function loadVersion(versionId: string): Promise<VersionFull | null> {
  const supabase = await createClient();
  const [{ data: v }, { data: dims }, { data: crit }, { data: cw }, { data: dw }] = await Promise.all([
    supabase.from("framework_versions").select("id, version_no, label, status, notes, published_at, framework_id").eq("id", versionId).maybeSingle(),
    supabase.from("evaluation_dimensions").select("id, code, label, description, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("evaluation_criteria").select("id, code, label, description, default_weight, sort_order, dimension_id").eq("version_id", versionId).order("sort_order"),
    supabase.from("position_criteria_weights").select("criterion_id, framework_key, weight").eq("version_id", versionId),
    supabase.from("position_dimension_weights").select("framework_key, dimension_code, weight").eq("version_id", versionId),
  ]);
  if (!v) return null;
  const dimById = new Map((dims ?? []).map((d) => [d.id, d.code as DimensionCode]));
  const criterionWeights: VersionModel["criterionWeights"] = {};
  for (const w of cw ?? []) (criterionWeights[w.criterion_id] ??= {})[w.framework_key as FrameworkKey] = Number(w.weight);
  const dimensionWeights: VersionModel["dimensionWeights"] = {};
  for (const w of dw ?? []) (dimensionWeights[w.framework_key as FrameworkKey] ??= {})[w.dimension_code as DimensionCode] = Number(w.weight);
  return {
    id: v.id,
    versionNo: v.version_no,
    label: v.label,
    status: v.status as VersionFull["status"],
    notes: v.notes,
    publishedAt: v.published_at,
    frameworkId: v.framework_id,
    dimensions: (dims ?? []).map((d) => ({ id: d.id, code: d.code as DimensionCode, label: d.label, description: d.description, sortOrder: d.sort_order })),
    criteria: (crit ?? []).map((c) => ({
      id: c.id, code: c.code, label: c.label, description: c.description, dimension: dimById.get(c.dimension_id)!,
      defaultWeight: c.default_weight == null ? null : Number(c.default_weight), sortOrder: c.sort_order,
    })),
    criterionWeights,
    dimensionWeights,
  };
}

/** Référentiel individuel du club et ses versions. */
export const getFramework = cache(async (ctx: AccessContext) => {
  const supabase = await createClient();
  const { data: fw } = await supabase.from("evaluation_frameworks").select("id, name, description").eq("club_id", ctx.clubId).eq("kind", "individuel").maybeSingle();
  if (!fw) return null;
  const { data: versions } = await supabase
    .from("framework_versions")
    .select("id, version_no, label, status, notes, published_at, created_at")
    .eq("framework_id", fw.id)
    .order("version_no", { ascending: false });
  const list = versions ?? [];
  return {
    ...fw,
    versions: list,
    published: list.find((v) => v.status === "publie") ?? null,
    draft: list.find((v) => v.status === "brouillon") ?? null,
  };
});

export const getPublishedVersion = cache(async (ctx: AccessContext) => {
  const fw = await getFramework(ctx);
  return fw?.published ? loadVersion(fw.published.id) : null;
});

export const getMinObservations = cache(async (ctx: AccessContext) => {
  const supabase = await createClient();
  const { data } = await supabase.from("application_settings").select("min_observations_for_index").eq("club_id", ctx.clubId).maybeSingle();
  return data?.min_observations_for_index ?? 3;
});

export type Period = { key: string; label: string; from: string | null; to: string | null };

/** Périodes proposées : saison active, 30 et 90 derniers jours, tout l'historique. */
export async function periods(ctx: AccessContext, today: string): Promise<Period[]> {
  const scope = await getScope(ctx);
  const minus = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const out: Period[] = [];
  if (scope.club.season) out.push({ key: "saison", label: `Saison ${scope.club.season.label}`, from: scope.club.season.starts_on, to: scope.club.season.ends_on });
  out.push({ key: "30j", label: "30 derniers jours", from: minus(30), to: today });
  out.push({ key: "90j", label: "90 derniers jours", from: minus(90), to: today });
  out.push({ key: "tout", label: "Tout l'historique", from: null, to: null });
  return out;
}

type ObsRow = Observation & { playerId: string; sessionId: string; title: string; evaluatorId: string | null };

/** Évaluations validées ou publiées, par joueuse, sur une période. */
export async function loadObservations(ctx: AccessContext, opts: { playerId?: string; from?: string | null; to?: string | null } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("individual_evaluations")
    .select("id, player_id, framework_key, evaluator_id, evaluation_sessions!inner(id, title, evaluated_on, context, status, framework_version_id), evaluation_scores(criterion_id, score)")
    .eq("club_id", ctx.clubId)
    .in("evaluation_sessions.status", [...VALIDATED]);
  if (opts.playerId) q = q.eq("player_id", opts.playerId);
  if (opts.from) q = q.gte("evaluation_sessions.evaluated_on", opts.from);
  if (opts.to) q = q.lte("evaluation_sessions.evaluated_on", opts.to);
  const { data } = await q;
  const rows: ObsRow[] = (data ?? []).map((r) => {
    const s = r.evaluation_sessions as unknown as { id: string; title: string; evaluated_on: string; context: Context; framework_version_id: string };
    return {
      id: r.id,
      playerId: r.player_id,
      sessionId: s.id,
      title: s.title,
      evaluatorId: r.evaluator_id,
      date: s.evaluated_on,
      context: s.context,
      versionId: s.framework_version_id,
      frameworkKey: r.framework_key as FrameworkKey,
      scores: (r.evaluation_scores ?? []).map((x) => ({ criterionId: x.criterion_id, score: x.score })),
    };
  });
  const versionIds = [...new Set(rows.map((r) => r.versionId))];
  const versions = new Map<string, VersionFull>();
  await Promise.all(versionIds.map(async (id) => {
    const v = await loadVersion(id);
    if (v) versions.set(id, v);
  }));
  return { rows, versions };
}

export type SquadRow = { player: PlayerOption; indices: PlayerIndices };

/** Indices de toutes les joueuses actives sur une période. */
export async function squadIndices(ctx: AccessContext, period: { from: string | null; to: string | null }) {
  const [players, reference, min, { rows, versions }] = await Promise.all([
    listPlayerOptions(ctx), getPublishedVersion(ctx), getMinObservations(ctx), loadObservations(ctx, period),
  ]);
  if (!reference) return { rows: [] as SquadRow[], reference: null, min };
  const byPlayer = new Map<string, Observation[]>();
  for (const r of rows) (byPlayer.get(r.playerId) ?? byPlayer.set(r.playerId, []).get(r.playerId)!).push(r);
  const out: SquadRow[] = players.map((p) => ({ player: p, indices: aggregatePlayer(byPlayer.get(p.id) ?? [], versions, reference, min) }));
  return { rows: out, reference, min };
}

export function defaultKey(position: string | null): FrameworkKey | null {
  return position ? POSITION_FRAMEWORK_KEY[position] ?? null : null;
}

export async function profileNames(ids: (string | null)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (!list.length) return names;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", list);
  for (const p of data ?? []) names.set(p.id, p.full_name || "Membre du staff");
  return names;
}

export { DIMENSION_CODES };

/** Séance d'évaluation, joueuses évaluées et notes. */
export async function loadEvaluationSession(ctx: AccessContext, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("evaluation_sessions")
    .select("id, title, context, evaluated_on, notes, status, framework_version_id, match_id, training_session_id, created_by, validated_by, validated_at, matches(id, kickoff_at, opponents(name)), training_sessions(id, number, session_date, theme)")
    .eq("id", id)
    .maybeSingle();
  if (!s) return null;
  const [version, { data: evals }] = await Promise.all([
    loadVersion(s.framework_version_id),
    supabase
      .from("individual_evaluations")
      .select("id, player_id, framework_key, position_id, minutes_played, comment, evaluator_id, updated_at, evaluation_scores(criterion_id, score, fact, interpretation)")
      .eq("evaluation_session_id", id),
  ]);
  return { session: s, version: version!, evaluations: evals ?? [] };
}
export type EvaluationSessionFull = NonNullable<Awaited<ReturnType<typeof loadEvaluationSession>>>;
