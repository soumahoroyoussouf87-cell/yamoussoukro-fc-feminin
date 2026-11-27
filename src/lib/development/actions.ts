"use server";

/** Plans de développement : plans, objectifs, exercices correctifs, réévaluations. Cohérence et droits appliqués par la base. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError as baseError } from "@/lib/phase2/forms";
import { DECISIONS, OBJ_DIMENSIONS, OBJ_STATUSES, PLAN_STATUSES, PRIORITIES, SCOPES } from "@/components/development/labels";

type R = { ok?: boolean; error?: string };
const dbError = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "23514" && e.message && !/violates|viole/.test(e.message) ? e.message : baseError(e, fallback);
const uuid = z.uuid();
const nullable = (v: unknown) => (v === "" || v == null ? null : v);
const optText = (max: number) => z.preprocess((v) => v ?? "", z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable());
const optDate = z.preprocess(nullable, z.iso.date("Date invalide").nullable());
const optNum = z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
  z.number("Nombre invalide").min(-99999).max(99999).nullable());
const SECTOR_CODES = ["gardiennes", "defense", "milieu", "attaque", "couloir_droit", "couloir_gauche", "axe_central"] as const;

function touch(planId?: string) {
  revalidatePath("/developpement", "layout");
  if (planId) revalidatePath(`/developpement/${planId}`);
  revalidatePath("/tableau-de-bord");
}

// ----------------------------------------------------------------- Plans
const planSchema = z.object({
  title: z.string().trim().min(2, "Titre requis (2 caractères minimum)").max(160),
  starts_on: z.iso.date("Date de début invalide"),
  ends_on: z.iso.date("Date de fin invalide"),
  owner_staff_id: z.preprocess(nullable, uuid.nullable()),
  findings: optText(3000),
  analysis: optText(3000),
  status: z.enum(PLAN_STATUSES),
  next_review_on: optDate,
});

export type PlanFormState = { error?: string } | undefined;

export async function createPlan(_: PlanFormState, fd: FormData): Promise<PlanFormState> {
  const ctx = await requirePermission("development.write");
  const scope = z.enum(SCOPES).safeParse(fd.get("scope"));
  if (!scope.success) return { error: "Portée invalide." };
  const s = planSchema.pick({ title: true, starts_on: true, ends_on: true, owner_staff_id: true, next_review_on: true }).safeParse({
    title: fd.get("title"), starts_on: fd.get("starts_on"), ends_on: fd.get("ends_on"), owner_staff_id: fd.get("owner_staff_id"), next_review_on: fd.get("next_review_on"),
  });
  if (!s.success) return { error: s.error.issues[0].message };
  if (s.data.ends_on < s.data.starts_on) return { error: "La date de fin précède la date de début." };
  let player_id: string | null = null;
  let sector_code: string | null = null;
  if (scope.data === "individuel") {
    const p = uuid.safeParse(fd.get("player_id"));
    if (!p.success) return { error: "Choisis la joueuse." };
    player_id = p.data;
  } else if (scope.data === "sectoriel") {
    const c = z.enum(SECTOR_CODES).safeParse(fd.get("sector_code"));
    if (!c.success) return { error: "Choisis le secteur." };
    sector_code = c.data;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_plans")
    .insert({ club_id: ctx.clubId, scope: scope.data, player_id, sector_code, ...s.data }).select("id").single();
  if (error || !data) return { error: dbError(error, "Création refusée.") };
  touch();
  redirect(`/developpement/${data.id}`);
}

export async function updatePlan(id: string, patch: Partial<z.input<typeof planSchema>>): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = planSchema.partial().safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_plans").update(s.data).eq("id", id).select("id");
  if (error) return { error: dbError(error, "Modification refusée.") };
  if (!data?.length) return { error: "Modification refusée." };
  touch(id);
  return { ok: true };
}

export async function deletePlan(id: string): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_plans").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  redirect("/developpement");
}

// ----------------------------------------------------------------- Objectifs
const objectiveSchema = z.object({
  label: z.string().trim().min(2, "Objectif requis (2 caractères minimum)").max(200),
  dimension: z.preprocess(nullable, z.enum(OBJ_DIMENSIONS).nullable()),
  criterion_code: z.preprocess(nullable, z.string().regex(/^[a-z0-9_]{2,60}$/).nullable()),
  measure: optText(300),
  baseline: optNum,
  target: optNum,
  unit: optText(20),
  due_on: optDate,
  priority: z.enum(PRIORITIES),
  status: z.enum(OBJ_STATUSES),
});

export async function addObjective(planId: string, input: Partial<z.input<typeof objectiveSchema>> & { label: string }): Promise<R> {
  const ctx = await requirePermission("development.write");
  if (!uuid.safeParse(planId).success) return { error: "Action invalide." };
  const s = objectiveSchema.partial({ status: true, priority: true }).safeParse({ priority: "normale", ...input });
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { count } = await supabase.from("development_objectives").select("id", { count: "exact", head: true }).eq("plan_id", planId);
  const { error } = await supabase.from("development_objectives").insert({ club_id: ctx.clubId, plan_id: planId, sort_order: (count ?? 0) + 1, ...s.data });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touch(planId);
  return { ok: true };
}

export async function updateObjective(id: string, patch: Partial<z.input<typeof objectiveSchema>>): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = objectiveSchema.partial().safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_objectives").update(s.data).eq("id", id).select("plan_id");
  if (error) return { error: dbError(error, "Modification refusée.") };
  if (!data?.length) return { error: "Modification refusée." };
  touch(data[0].plan_id);
  return { ok: true };
}

export async function deleteObjective(id: string): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_objectives").delete().eq("id", id).select("plan_id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch(data[0].plan_id);
  return { ok: true };
}

// ----------------------------------------------------------------- Exercices correctifs
const actionSchema = z.object({
  exercise_id: z.preprocess(nullable, uuid.nullable()),
  label: z.string().trim().min(2, "Exercice ou consigne requis").max(200),
  frequency: optText(80),
  notes: optText(1000),
});

export async function addAction(objectiveId: string, input: z.input<typeof actionSchema>): Promise<R> {
  const ctx = await requirePermission("development.write");
  if (!uuid.safeParse(objectiveId).success) return { error: "Action invalide." };
  const s = actionSchema.safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { count } = await supabase.from("development_actions").select("id", { count: "exact", head: true }).eq("objective_id", objectiveId);
  const { error } = await supabase.from("development_actions").insert({ club_id: ctx.clubId, objective_id: objectiveId, sort_order: (count ?? 0) + 1, ...s.data });
  if (error) return { error: dbError(error, "Ajout refusé.") };
  touch();
  return { ok: true };
}

export async function updateAction(id: string, patch: Partial<z.input<typeof actionSchema>>): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const s = actionSchema.partial().safeParse(patch);
  if (!s.success) return { error: s.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_actions").update(s.data).eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Modification refusée.") };
  touch();
  return { ok: true };
}

export async function deleteAction(id: string): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_actions").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch();
  return { ok: true };
}

// ----------------------------------------------------------------- Réévaluations
const reviewSchema = z.object({
  reviewed_on: z.iso.date("Date invalide"),
  facts: optText(3000),
  interpretation: optText(3000),
  decision: z.enum(DECISIONS),
  next_review_on: optDate,
  items: z.array(z.object({ objective_id: uuid, value: optNum, status: z.enum(OBJ_STATUSES), comment: optText(500) })).max(40),
});

export async function addReview(planId: string, input: z.input<typeof reviewSchema>): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(planId).success) return { error: "Action invalide." };
  const s = reviewSchema.safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const { items, ...review } = s.data;
  if (review.decision !== "cloturer" && !review.next_review_on) return { error: "Indique la date de la prochaine réévaluation (ou clôture le plan)." };
  if (review.next_review_on && review.next_review_on <= review.reviewed_on) return { error: "La prochaine réévaluation doit suivre celle-ci." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_development_review", { p_plan: planId, p_review: review, p_items: items });
  if (error) return { error: dbError(error, "Réévaluation refusée.") };
  touch(planId);
  return { ok: true };
}

export async function deleteReview(id: string): Promise<R> {
  await requirePermission("development.write");
  if (!uuid.safeParse(id).success) return { error: "Action invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("development_reviews").delete().eq("id", id).select("plan_id");
  if (error || !data?.length) return { error: dbError(error, "Suppression refusée.") };
  touch(data[0].plan_id);
  return { ok: true };
}
