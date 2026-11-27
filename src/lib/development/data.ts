import "server-only";
import type { AccessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Decision, ObjDimension, ObjStatus, PlanStatus, Scope } from "@/components/development/labels";

export type PlanRow = {
  id: string; scope: Scope; title: string; starts_on: string; ends_on: string; status: PlanStatus;
  next_review_on: string | null; player: { id: string; name: string } | null; sector_code: string | null;
  owner: string | null; objectives: { status: ObjStatus }[];
};

const PLAN_COLS = "id, scope, title, starts_on, ends_on, status, next_review_on, sector_code, player_id, players(first_name, last_name), staff_members(first_name, last_name), development_objectives(status)";

type RawPlan = {
  id: string; scope: string; title: string; starts_on: string; ends_on: string; status: string; next_review_on: string | null; sector_code: string | null;
  player_id: string | null; players: { first_name: string; last_name: string } | null; staff_members: { first_name: string; last_name: string } | null;
  development_objectives: { status: string }[];
};

const toRow = (p: RawPlan): PlanRow => ({
  id: p.id, scope: p.scope as Scope, title: p.title, starts_on: p.starts_on, ends_on: p.ends_on, status: p.status as PlanStatus,
  next_review_on: p.next_review_on, sector_code: p.sector_code,
  player: p.player_id && p.players ? { id: p.player_id, name: `${p.players.first_name} ${p.players.last_name}` } : null,
  owner: p.staff_members ? `${p.staff_members.first_name} ${p.staff_members.last_name}` : null,
  objectives: (p.development_objectives ?? []).map((o) => ({ status: o.status as ObjStatus })),
});

export async function listPlans(ctx: AccessContext, opts: { scope?: Scope; status?: PlanStatus | "tous"; playerId?: string } = {}): Promise<PlanRow[]> {
  const supabase = await createClient();
  let q = supabase.from("development_plans").select(PLAN_COLS).eq("club_id", ctx.clubId);
  if (opts.scope) q = q.eq("scope", opts.scope);
  if (opts.status && opts.status !== "tous") q = q.eq("status", opts.status);
  if (opts.playerId) q = q.eq("player_id", opts.playerId);
  const { data } = await q.order("next_review_on", { ascending: true, nullsFirst: false }).order("ends_on");
  return ((data ?? []) as unknown as RawPlan[]).map(toRow);
}

export type Action = { id: string; label: string; frequency: string | null; notes: string | null; exercise: { id: string; title: string } | null };
export type Objective = {
  id: string; label: string; dimension: ObjDimension | null; criterion_code: string | null; measure: string | null;
  baseline: number | null; target: number | null; unit: string | null; due_on: string | null; priority: "basse" | "normale" | "haute";
  status: ObjStatus; sort_order: number; actions: Action[];
};
export type Review = {
  id: string; reviewed_on: string; facts: string | null; interpretation: string | null; decision: Decision; next_review_on: string | null;
  author: string | null; items: { objective_id: string; value: number | null; status: ObjStatus; comment: string | null }[];
};
export type PlanFull = Omit<PlanRow, "objectives"> & { owner_staff_id: string | null; findings: string | null; analysis: string | null; objectives: Objective[]; reviews: Review[] };

const num = (v: unknown) => (v == null ? null : Number(v));

export async function loadPlan(ctx: AccessContext, id: string): Promise<PlanFull | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: p } = await supabase.from("development_plans").select(`${PLAN_COLS}, owner_staff_id, findings, analysis`).eq("id", id).eq("club_id", ctx.clubId).maybeSingle();
  if (!p) return null;
  const [{ data: objs }, { data: reviews }] = await Promise.all([
    supabase.from("development_objectives")
      .select("id, label, dimension, criterion_code, measure, baseline, target, unit, due_on, priority, status, sort_order, development_actions(id, label, frequency, notes, sort_order, exercise_id, exercises(id, title))")
      .eq("plan_id", id).order("sort_order").order("created_at"),
    supabase.from("development_reviews")
      .select("id, reviewed_on, facts, interpretation, decision, next_review_on, created_by, created_at, development_review_items(objective_id, value, status, comment)")
      .eq("plan_id", id).order("reviewed_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const authorIds = [...new Set((reviews ?? []).map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = new Map((authors ?? []).map((a) => [a.id, a.full_name]));
  const base = toRow(p as unknown as RawPlan);
  return {
    ...base,
    owner_staff_id: p.owner_staff_id, findings: p.findings, analysis: p.analysis,
    objectives: (objs ?? []).map((o) => ({
      id: o.id, label: o.label, dimension: o.dimension as ObjDimension | null, criterion_code: o.criterion_code, measure: o.measure,
      baseline: num(o.baseline), target: num(o.target), unit: o.unit, due_on: o.due_on, priority: o.priority as Objective["priority"],
      status: o.status as ObjStatus, sort_order: o.sort_order,
      actions: [...(o.development_actions ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((a) => ({
        id: a.id, label: a.label, frequency: a.frequency, notes: a.notes,
        exercise: a.exercises ? { id: (a.exercises as { id: string; title: string }).id, title: (a.exercises as { id: string; title: string }).title } : null,
      })),
    })),
    reviews: (reviews ?? []).map((r) => ({
      id: r.id, reviewed_on: r.reviewed_on, facts: r.facts, interpretation: r.interpretation, decision: r.decision as Decision,
      next_review_on: r.next_review_on, author: r.created_by ? nameOf.get(r.created_by) ?? null : null,
      items: (r.development_review_items ?? []).map((i) => ({ objective_id: i.objective_id, value: num(i.value), status: i.status as ObjStatus, comment: i.comment })),
    })),
  };
}

/** Objectifs de tous les plans (vue transversale). */
export async function listObjectives(ctx: AccessContext, opts: { activeOnly?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase.from("development_objectives")
    .select("id, label, dimension, baseline, target, unit, due_on, priority, status, development_plans!inner(id, title, scope, status, sector_code, players(first_name, last_name)), development_actions(id)")
    .eq("club_id", ctx.clubId);
  if (opts.activeOnly) q = q.eq("development_plans.status", "actif");
  const { data } = await q.order("due_on", { ascending: true, nullsFirst: false });
  return (data ?? []).map((o) => {
    const p = o.development_plans as unknown as { id: string; title: string; scope: Scope; status: PlanStatus; sector_code: string | null; players: { first_name: string; last_name: string } | null };
    return {
      id: o.id, label: o.label, dimension: o.dimension as ObjDimension | null, baseline: num(o.baseline), target: num(o.target), unit: o.unit,
      due_on: o.due_on, priority: o.priority, status: o.status as ObjStatus, actions: (o.development_actions ?? []).length,
      plan: { id: p.id, title: p.title, scope: p.scope, status: p.status, sector_code: p.sector_code, player: p.players ? `${p.players.first_name} ${p.players.last_name}` : null },
    };
  });
}

/** Exercices correctifs prescrits, regroupés par exercice de la bibliothèque (ou consigne libre). */
export async function listActions(ctx: AccessContext) {
  const supabase = await createClient();
  const { data } = await supabase.from("development_actions")
    .select("id, label, frequency, exercise_id, exercises(id, title, category), development_objectives!inner(id, label, status, development_plans!inner(id, title, scope, status, sector_code, players(first_name, last_name)))")
    .eq("club_id", ctx.clubId)
    .eq("development_objectives.development_plans.status", "actif");
  return (data ?? []).map((a) => {
    const o = a.development_objectives as unknown as { id: string; label: string; status: ObjStatus; development_plans: { id: string; title: string; scope: Scope; sector_code: string | null; players: { first_name: string; last_name: string } | null } };
    const e = a.exercises as unknown as { id: string; title: string; category: string } | null;
    const p = o.development_plans;
    return {
      id: a.id, label: a.label, frequency: a.frequency, exercise: e,
      objective: { id: o.id, label: o.label, status: o.status },
      plan: { id: p.id, title: p.title, scope: p.scope, sector_code: p.sector_code, player: p.players ? `${p.players.first_name} ${p.players.last_name}` : null },
    };
  });
}

/** Réévaluations réalisées récemment (toutes portées). */
export async function listRecentReviews(ctx: AccessContext, limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase.from("development_reviews")
    .select("id, reviewed_on, decision, development_plans!inner(id, title, scope, sector_code, players(first_name, last_name))")
    .eq("club_id", ctx.clubId).order("reviewed_on", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => {
    const p = r.development_plans as unknown as { id: string; title: string; scope: Scope; sector_code: string | null; players: { first_name: string; last_name: string } | null };
    return { id: r.id, reviewed_on: r.reviewed_on, decision: r.decision as Decision, plan: { id: p.id, title: p.title, scope: p.scope, sector_code: p.sector_code, player: p.players ? `${p.players.first_name} ${p.players.last_name}` : null } };
  });
}
