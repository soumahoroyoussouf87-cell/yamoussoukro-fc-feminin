import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getMinObservations, VALIDATED } from "./data";
import { aggregateTeam, teamDevelopment, type CollectiveObservation, type GameVersionModel, type MomentCode } from "./collective";

export type GamePrinciple = GameVersionModel["principles"][number] & {
  description: string | null; expected_behaviors: string | null; evaluation_criteria: string | null;
  subprinciples: { id: string; label: string; description: string | null }[];
  exercises: { id: string; title: string }[];
};
export type GameVersionFull = Omit<GameVersionModel, "principles"> & {
  status: "brouillon" | "publie" | "archive"; notes: string | null; publishedAt: string | null; modelId: string;
  principles: GamePrinciple[];
};

export async function loadGameVersion(versionId: string): Promise<GameVersionFull | null> {
  if (!/^[0-9a-f-]{36}$/.test(versionId)) return null;
  const supabase = await createClient();
  const [{ data: v }, { data: moments }, { data: principles }, { data: subs }, { data: links }] = await Promise.all([
    supabase.from("game_model_versions").select("id, version_no, label, status, notes, published_at, model_id").eq("id", versionId).maybeSingle(),
    supabase.from("game_moments").select("id, code, label, description, weight, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("game_principles").select("id, code, label, description, expected_behaviors, evaluation_criteria, moment_id, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("game_subprinciples").select("id, principle_id, label, description, sort_order").eq("version_id", versionId).order("sort_order"),
    supabase.from("game_principle_exercises").select("principle_id, exercises(id, title)").eq("version_id", versionId),
  ]);
  if (!v) return null;
  const momentById = new Map((moments ?? []).map((m) => [m.id, m.code as MomentCode]));
  return {
    id: v.id, versionNo: v.version_no, label: v.label, status: v.status as GameVersionFull["status"], notes: v.notes,
    publishedAt: v.published_at, modelId: v.model_id,
    moments: (moments ?? []).map((m) => ({ id: m.id, code: m.code as MomentCode, label: m.label, weight: Number(m.weight), description: m.description })),
    principles: (principles ?? []).map((p) => ({
      id: p.id, code: p.code, label: p.label, moment: momentById.get(p.moment_id)!, sortOrder: p.sort_order,
      description: p.description, expected_behaviors: p.expected_behaviors, evaluation_criteria: p.evaluation_criteria,
      subprinciples: (subs ?? []).filter((s) => s.principle_id === p.id).map((s) => ({ id: s.id, label: s.label, description: s.description })),
      exercises: (links ?? []).filter((l) => l.principle_id === p.id).map((l) => l.exercises as unknown as { id: string; title: string }).filter(Boolean),
    })),
  };
}

export const getGameModel = cache(async (ctx: AccessContext) => {
  const supabase = await createClient();
  const { data: model } = await supabase.from("game_models").select("id, name").eq("club_id", ctx.clubId).maybeSingle();
  if (!model) return null;
  const { data: versions } = await supabase.from("game_model_versions")
    .select("id, version_no, label, status, notes, published_at, created_at").eq("model_id", model.id).order("version_no", { ascending: false });
  const list = versions ?? [];
  return { ...model, versions: list, published: list.find((v) => v.status === "publie") ?? null, draft: list.find((v) => v.status === "brouillon") ?? null };
});

export const getPublishedGameVersion = cache(async (ctx: AccessContext) => {
  const m = await getGameModel(ctx);
  return m?.published ? loadGameVersion(m.published.id) : null;
});

export async function listCompactnessTargets(ctx: AccessContext) {
  const supabase = await createClient();
  const { data } = await supabase.from("compactness_targets").select("id, situation, relation_code, min_m, max_m").eq("club_id", ctx.clubId);
  return (data ?? []).map((t) => ({ ...t, min_m: Number(t.min_m), max_m: Number(t.max_m) }));
}

export type GameSystem = { id: string; parent_id: string | null; name: string; base: string; phase: string; slots: { label: string; x: number; y: number }[]; notes: string | null; is_reference: boolean; sort_order: number };

export async function listSystems(ctx: AccessContext): Promise<GameSystem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("game_systems").select("id, parent_id, name, base, phase, slots, notes, is_reference, sort_order")
    .eq("club_id", ctx.clubId).order("sort_order").order("created_at");
  return (data ?? []) as unknown as GameSystem[];
}

type CollRow = CollectiveObservation & { title: string };

/** Évaluations collectives validées sur une période, avec les versions du projet de jeu utilisées. */
export async function loadCollectiveObservations(ctx: AccessContext, opts: { from?: string | null; to?: string | null } = {}) {
  const supabase = await createClient();
  let q = supabase.from("collective_evaluations")
    .select("id, title, evaluated_on, context, game_model_version_id, collective_scores(unit_kind, unit_code, criterion_code, score), collective_measures(relation_code, situation, distance_m, target_min, target_max)")
    .eq("club_id", ctx.clubId).in("status", [...VALIDATED]);
  if (opts.from) q = q.gte("evaluated_on", opts.from);
  if (opts.to) q = q.lte("evaluated_on", opts.to);
  const { data } = await q;
  const rows: CollRow[] = (data ?? []).map((e) => ({
    id: e.id, title: e.title, date: e.evaluated_on, context: e.context as CollRow["context"], versionId: e.game_model_version_id,
    scores: (e.collective_scores ?? []).map((s) => ({ kind: s.unit_kind as CollRow["scores"][number]["kind"], unit: s.unit_code, criterion: s.criterion_code, score: s.score })),
    measures: (e.collective_measures ?? []).map((m) => ({
      relation: m.relation_code, situation: m.situation, distance: Number(m.distance_m),
      targetMin: m.target_min == null ? null : Number(m.target_min), targetMax: m.target_max == null ? null : Number(m.target_max),
    })),
  }));
  const versions = new Map<string, GameVersionFull>();
  await Promise.all([...new Set(rows.map((r) => r.versionId))].map(async (id) => {
    const v = await loadGameVersion(id);
    if (v) versions.set(id, v);
  }));
  return { rows, versions };
}

export async function loadCollectiveEvaluation(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: e } = await supabase.from("collective_evaluations")
    .select("id, title, context, evaluated_on, notes, status, game_model_version_id, match_id, training_session_id, system_id, created_by, matches(id, kickoff_at, opponents(name)), training_sessions(id, number, theme), game_systems(id, name)")
    .eq("id", id).maybeSingle();
  if (!e) return null;
  const [version, { data: scores }, { data: measures }] = await Promise.all([
    loadGameVersion(e.game_model_version_id),
    supabase.from("collective_scores").select("unit_kind, unit_code, criterion_code, score, fact, interpretation").eq("collective_evaluation_id", id),
    supabase.from("collective_measures").select("relation_code, situation, distance_m, target_min, target_max, note").eq("collective_evaluation_id", id),
  ]);
  return { evaluation: e, version: version!, scores: scores ?? [], measures: (measures ?? []).map((m) => ({ ...m, distance_m: Number(m.distance_m), target_min: m.target_min == null ? null : Number(m.target_min), target_max: m.target_max == null ? null : Number(m.target_max) })) };
}

/** Indices collectifs d'une période (projet de jeu publié comme référence). */
export async function teamIndices(ctx: AccessContext, period: { from: string | null; to: string | null }) {
  const [reference, min, { rows, versions }] = await Promise.all([
    getPublishedGameVersion(ctx), getMinObservations(ctx), loadCollectiveObservations(ctx, period),
  ]);
  if (!reference) return { reference: null, min, team: null, dev: null, rows };
  const team = aggregateTeam(rows, versions, reference, min);
  const dev = teamDevelopment(team.timeline, (id) => versions.get(id)?.versionNo);
  return { reference, min, team, dev, rows };
}
