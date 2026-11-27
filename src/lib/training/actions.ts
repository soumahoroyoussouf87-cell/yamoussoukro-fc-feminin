"use server";

/**
 * Actions serveur du module « Fiches de séance ».
 * Toutes les écritures passent par la session de l'utilisateur : la base applique RLS,
 * le circuit de validation et le verrouillage des séances validées.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/phase2/forms";
import { getScope } from "@/lib/phase2/data";
import { mondayOf } from "@/lib/domain/match-day";
import { parseDiagram } from "./diagram";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fields?: Record<string, string> };

const fail = (error: string, fields?: Record<string, string>) => ({ ok: false as const, error, fields });
const uuid = z.uuid();
const txt = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).transform((v) => (v === "" ? null : v)).nullable();
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Heure invalide").or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable();
const int = (min: number, max: number) => z.number().int().min(min, `Minimum ${min}`).max(max, `Maximum ${max}`).nullable();
const link = z.object({ title: z.string().trim().min(1).max(120), url: z.url({ protocol: /^https$/, message: "Lien https:// attendu" }).max(500) });

function fieldErrors(e: z.ZodError) {
  const f: Record<string, string> = {};
  for (const i of e.issues) f[String(i.path[0])] ??= i.message;
  return fail("Certains champs sont invalides.", f);
}

function touch(sessionId?: string) {
  if (sessionId) revalidatePath(`/entrainement/seances/${sessionId}`);
  revalidatePath("/entrainement", "layout");
  revalidatePath("/planification", "layout");
}

async function sessionOf(table: "session_phases" | "session_exercises" | "session_equipment", id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("session_id").eq("id", id).maybeSingle();
  return (data as { session_id: string } | null)?.session_id ?? null;
}

// ------------------------------------------------------------------ Création
const createSchema = z.object({ date: z.iso.date("Date requise"), templateId: uuid.nullable().optional(), fromSessionId: uuid.nullable().optional() });

export async function createSessionDraft(input: z.input<typeof createSchema>): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  const v = createSchema.safeParse(input);
  if (!v.success) return fieldErrors(v.error);
  const scope = await getScope(ctx);
  if (!scope.seasonId || !scope.teamId) return fail("Définissez d'abord la saison active et l'équipe (Administration › Paramètres).");
  const supabase = await createClient();
  const { data: micro } = await supabase.from("microcycles").select("id").eq("team_id", scope.teamId).eq("week_start", mondayOf(v.data.date)).maybeSingle();
  const { data: created, error } = await supabase
    .from("training_sessions")
    .insert({ club_id: ctx.clubId, team_id: scope.teamId, season_id: scope.seasonId, session_date: v.data.date, microcycle_id: micro?.id ?? null, created_by: ctx.userId } as never)
    .select("id")
    .single();
  if (error || !created) return fail(dbError(error, "Création refusée."));
  const id = (created as { id: string }).id;
  if (v.data.templateId) {
    const { data: t } = await supabase.from("session_templates").select("payload").eq("id", v.data.templateId).maybeSingle();
    if (t) await applyPayload(ctx.clubId, id, t.payload as TemplatePayload);
  } else if (v.data.fromSessionId) {
    const payload = await sessionPayload(v.data.fromSessionId);
    if (payload) await applyPayload(ctx.clubId, id, payload);
  }
  touch(id);
  return { ok: true, id };
}

export async function createSessionAndOpen(formData: FormData) {
  const r = await createSessionDraft({
    date: String(formData.get("date") ?? ""),
    templateId: (formData.get("templateId") as string) || null,
  });
  if (!r.ok) redirect(`/entrainement/seances/nouvelle?erreur=${encodeURIComponent(r.error)}`);
  redirect(`/entrainement/seances/${r.id}?etape=1&nouvelle=1`);
}

// ------------------------------------------------------------------ Modèles et duplication
type TemplatePayload = {
  session: Record<string, unknown>;
  phases: { title: string; block: string | null; duration_min: number | null; notes: string | null; items: Record<string, unknown>[] }[];
  equipment: { item: string; quantity: number }[];
};
const SESSION_COPY = ["starts_at", "ends_at", "location", "theme", "sub_theme", "theme_id", "sub_theme_id", "main_objective", "secondary_objectives", "specific_objectives",
  "audience", "intensity", "planned_rpe", "game_system", "period", "responsible_staff_id", "notes", "video_links"] as const;
const ITEM_COPY = ["exercise_id", "block", "duration_min", "series", "recovery_sec", "pause_after_min", "repetitions", "recovery", "notes", "diagram_id"] as const;

async function sessionPayload(sessionId: string): Promise<TemplatePayload | null> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select("*, session_phases(*), session_exercises(*), session_equipment(item, quantity, sort_order)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!s) return null;
  const session: Record<string, unknown> = {};
  for (const k of SESSION_COPY) session[k] = (s as Record<string, unknown>)[k];
  const phases = [...(s.session_phases ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const items = s.session_exercises ?? [];
  return {
    session,
    phases: phases.map((p) => ({
      title: p.title, block: p.block, duration_min: p.duration_min, notes: p.notes,
      items: items.filter((i) => i.phase_id === p.id).sort((a, b) => a.sort_order - b.sort_order).map((i) => Object.fromEntries(ITEM_COPY.map((k) => [k, (i as Record<string, unknown>)[k]]))),
    })),
    equipment: [...(s.session_equipment ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((e) => ({ item: e.item, quantity: e.quantity })),
  };
}

async function applyPayload(clubId: string, sessionId: string, p: TemplatePayload) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const k of SESSION_COPY) if (p.session?.[k] !== undefined) patch[k] = p.session[k];
  if (Object.keys(patch).length) await supabase.from("training_sessions").update(patch as never).eq("id", sessionId);
  let order = 0;
  for (const ph of p.phases ?? []) {
    const { data: phase } = await supabase
      .from("session_phases")
      .insert({ club_id: clubId, session_id: sessionId, sort_order: order++, title: ph.title, block: ph.block as never, duration_min: ph.duration_min, notes: ph.notes })
      .select("id")
      .single();
    if (!phase) continue;
    const rows = (ph.items ?? []).map((i, k) => ({ ...Object.fromEntries(ITEM_COPY.map((c) => [c, i[c] ?? null])), club_id: clubId, session_id: sessionId, phase_id: phase.id, sort_order: k }));
    if (rows.length) await supabase.from("session_exercises").insert(rows as never);
  }
  if (p.equipment?.length) await supabase.from("session_equipment").insert(p.equipment.map((e, k) => ({ club_id: clubId, session_id: sessionId, item: e.item, quantity: e.quantity, sort_order: k })));
}

export async function duplicateSessionTo(sessionId: string, date: string): Promise<Result<{ id: string }>> {
  return createSessionDraft({ date, fromSessionId: sessionId });
}

export async function saveAsTemplate(sessionId: string, name: string, description: string): Promise<Result> {
  const ctx = await requirePermission("planning.write");
  const n = z.string().trim().min(2, "Nom requis (2 caractères minimum)").max(120).safeParse(name);
  if (!n.success) return fail(n.error.issues[0].message, { name: n.error.issues[0].message });
  const payload = await sessionPayload(sessionId);
  if (!payload) return fail("Séance introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.from("session_templates").insert({ club_id: ctx.clubId, name: n.data, description: description.trim().slice(0, 500) || null, payload: payload as never, created_by: ctx.userId });
  if (error) return fail(error.code === "23505" ? "Un modèle porte déjà ce nom." : dbError(error, "Enregistrement du modèle refusé."));
  revalidatePath("/entrainement/modeles");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<Result> {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_templates").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Suppression refusée."));
  revalidatePath("/entrainement/modeles");
  return { ok: true };
}

// ------------------------------------------------------------------ Informations de séance (sauvegarde automatique)
const patchSchema = z
  .object({
    session_date: z.iso.date("Date invalide"),
    starts_at: time,
    ends_at: time,
    location: txt(120),
    period: txt(60),
    game_system: txt(40),
    audience: txt(120),
    responsible_staff_id: uuid.nullable(),
    weather: txt(80),
    pitch_condition: txt(80),
    theme_id: uuid.nullable(),
    sub_theme_id: uuid.nullable(),
    main_objective: txt(1000),
    secondary_objectives: txt(2000),
    specific_objectives: z.array(z.string().trim().min(1).max(300)).max(12),
    intensity: z.enum(["repos", "faible", "moderee", "elevee", "maximale"]).nullable(),
    planned_rpe: int(1, 10),
    notes: txt(2000),
    video_links: z.array(link).max(20),
    wizard_step: z.number().int().min(1).max(8),
  })
  .partial();

export async function saveSessionPatch(sessionId: string, patch: z.input<typeof patchSchema>): Promise<Result<{ savedAt: string }>> {
  const ctx = await requirePermission("planning.write");
  if (!uuid.safeParse(sessionId).success) return fail("Séance inconnue.");
  const v = patchSchema.safeParse(patch);
  if (!v.success) return fieldErrors(v.error);
  const row: Record<string, unknown> = { ...v.data };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("training_sessions").select("starts_at, ends_at, team_id").eq("id", sessionId).maybeSingle();
  if (!cur) return fail("Séance introuvable.");
  const s = (row.starts_at !== undefined ? row.starts_at : cur.starts_at) as string | null;
  const e = (row.ends_at !== undefined ? row.ends_at : cur.ends_at) as string | null;
  if (s && e && e.slice(0, 5) <= s.slice(0, 5)) return fail("L'heure de fin doit suivre l'heure de début.", { ends_at: "Doit suivre le début" });
  // Le texte du thème suit la bibliothèque (affichage dans le calendrier et les listes).
  if (v.data.theme_id !== undefined || v.data.sub_theme_id !== undefined) {
    const ids = [v.data.theme_id, v.data.sub_theme_id].filter((x): x is string => !!x);
    const { data: themes } = ids.length ? await supabase.from("training_themes").select("id, name").in("id", ids) : { data: [] as { id: string; name: string }[] };
    const name = (tid: string | null | undefined) => (tid ? themes?.find((t) => t.id === tid)?.name ?? null : null);
    if (v.data.theme_id !== undefined) row.theme = name(v.data.theme_id);
    if (v.data.sub_theme_id !== undefined) row.sub_theme = name(v.data.sub_theme_id);
  }
  if (v.data.session_date) {
    const { data: micro } = await supabase.from("microcycles").select("id").eq("team_id", cur.team_id).eq("week_start", mondayOf(v.data.session_date)).maybeSingle();
    row.microcycle_id = micro?.id ?? null;
  }
  const { data, error } = await supabase.from("training_sessions").update(row as never).eq("id", sessionId).eq("club_id", ctx.clubId).select("updated_at");
  if (error || !data?.length) return fail(dbError(error, "Enregistrement refusé (séance validée ou droits insuffisants)."));
  if (!("wizard_step" in v.data && Object.keys(v.data).length === 1)) touch(sessionId);
  return { ok: true, savedAt: data[0].updated_at };
}

// ------------------------------------------------------------------ Thèmes
export async function createTheme(name: string, parentId: string | null): Promise<Result<{ id: string; name: string }>> {
  const ctx = await requirePermission("planning.write");
  const n = z.string().trim().min(2, "2 caractères minimum").max(120).safeParse(name);
  if (!n.success) return fail(n.error.issues[0].message);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("training_themes").select("id, name").eq("club_id", ctx.clubId).ilike("name", n.data).filter("parent_id", parentId ? "eq" : "is", parentId ?? null).maybeSingle();
  if (existing) return { ok: true, ...existing };
  const { data, error } = await supabase.from("training_themes").insert({ club_id: ctx.clubId, name: n.data, parent_id: parentId, created_by: ctx.userId }).select("id, name").single();
  if (error || !data) return fail(dbError(error, "Création du thème refusée."));
  revalidatePath("/entrainement/themes");
  return { ok: true, ...data };
}

export async function updateTheme(id: string, name: string, description: string | null): Promise<Result> {
  await requirePermission("planning.write");
  const n = z.string().trim().min(2).max(120).safeParse(name);
  if (!n.success) return fail("Nom invalide (2 à 120 caractères).");
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_themes").update({ name: n.data, description: description?.trim().slice(0, 1000) || null }).eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Modification refusée."));
  await supabase.from("training_sessions").update({ theme: n.data }).eq("theme_id", id);
  await supabase.from("training_sessions").update({ sub_theme: n.data }).eq("sub_theme_id", id);
  revalidatePath("/entrainement", "layout");
  return { ok: true };
}

export async function archiveTheme(id: string, archive: boolean): Promise<Result> {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_themes").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Action refusée."));
  revalidatePath("/entrainement/themes");
  return { ok: true };
}

// ------------------------------------------------------------------ Phases et exercices de la séance
export async function addPhase(sessionId: string, title: string, block: string | null): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  const t = z.string().trim().min(2, "Titre requis").max(120).safeParse(title);
  if (!t.success) return fail(t.error.issues[0].message);
  const supabase = await createClient();
  const { data: last } = await supabase.from("session_phases").select("sort_order").eq("session_id", sessionId).order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("session_phases")
    .insert({ club_id: ctx.clubId, session_id: sessionId, title: t.data, block: (block || null) as never, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) return fail(dbError(error, "Ajout refusé."));
  touch(sessionId);
  return { ok: true, id: data.id };
}

const phasePatch = z.object({ title: z.string().trim().min(2).max(120), duration_min: int(1, 180), notes: txt(1000) }).partial();
export async function updatePhase(id: string, patch: z.input<typeof phasePatch>): Promise<Result> {
  await requirePermission("planning.write");
  const v = phasePatch.safeParse(patch);
  if (!v.success) return fieldErrors(v.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_phases").update(v.data).eq("id", id).select("session_id");
  if (error || !data?.length) return fail(dbError(error, "Modification refusée."));
  touch(data[0].session_id);
  return { ok: true };
}

export async function deletePhase(id: string): Promise<Result> {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_phases").delete().eq("id", id).select("session_id");
  if (error || !data?.length) return fail(dbError(error, "Suppression refusée."));
  touch(data[0].session_id);
  return { ok: true };
}

/** Enregistre l'ordre complet (phases et exercices) après un glisser-déposer. */
const layoutSchema = z.array(z.object({ id: uuid, items: z.array(uuid).max(60) })).max(30);
export async function saveLayout(sessionId: string, layout: z.input<typeof layoutSchema>): Promise<Result> {
  await requirePermission("planning.write");
  const v = layoutSchema.safeParse(layout);
  if (!v.success) return fail("Ordre invalide.");
  const supabase = await createClient();
  for (const [pi, p] of v.data.entries()) {
    const { error } = await supabase.from("session_phases").update({ sort_order: pi }).eq("id", p.id).eq("session_id", sessionId);
    if (error) return fail(dbError(error, "Réorganisation refusée."));
    for (const [ii, itemId] of p.items.entries()) {
      const { error: e2 } = await supabase.from("session_exercises").update({ phase_id: p.id, sort_order: ii }).eq("id", itemId).eq("session_id", sessionId);
      if (e2) return fail(dbError(e2, "Réorganisation refusée."));
    }
  }
  touch(sessionId);
  return { ok: true };
}

export async function addItem(sessionId: string, phaseId: string, exerciseId: string): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  if (![sessionId, phaseId, exerciseId].every((x) => uuid.safeParse(x).success)) return fail("Paramètres invalides.");
  const supabase = await createClient();
  const [{ data: ex }, { data: last }, { data: phase }] = await Promise.all([
    supabase.from("exercises").select("duration_min, series, repetitions, recovery").eq("id", exerciseId).maybeSingle(),
    supabase.from("session_exercises").select("sort_order").eq("phase_id", phaseId).order("sort_order", { ascending: false }).limit(1),
    supabase.from("session_phases").select("block").eq("id", phaseId).maybeSingle(),
  ]);
  if (!ex) return fail("Exercice introuvable.");
  const { data, error } = await supabase
    .from("session_exercises")
    .insert({
      club_id: ctx.clubId, session_id: sessionId, phase_id: phaseId, exercise_id: exerciseId, block: phase?.block ?? null,
      sort_order: (last?.[0]?.sort_order ?? -1) + 1, duration_min: ex.duration_min, series: ex.series, repetitions: ex.repetitions, recovery: ex.recovery,
    } as never)
    .select("id")
    .single();
  if (error || !data) return fail(dbError(error, "Ajout refusé."));
  touch(sessionId);
  return { ok: true, id: (data as { id: string }).id };
}

const itemPatch = z
  .object({ duration_min: int(1, 180), series: int(1, 50), recovery_sec: int(0, 1800), pause_after_min: int(0, 60), repetitions: txt(60), recovery: txt(60), notes: txt(1000), diagram_id: uuid.nullable() })
  .partial();
export async function updateItem(id: string, patch: z.input<typeof itemPatch>): Promise<Result> {
  await requirePermission("planning.write");
  const v = itemPatch.safeParse(patch);
  if (!v.success) return fieldErrors(v.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_exercises").update(v.data).eq("id", id).select("session_id");
  if (error || !data?.length) return fail(dbError(error, "Modification refusée."));
  touch(data[0].session_id);
  return { ok: true };
}

export async function removeItem(id: string): Promise<Result> {
  await requirePermission("planning.write");
  const sessionId = await sessionOf("session_exercises", id);
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_exercises").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Suppression refusée."));
  touch(sessionId ?? undefined);
  return { ok: true };
}

// ------------------------------------------------------------------ Exercices (bibliothèque pédagogique)
const CATEGORIES = ["technique_offensive", "technique_defensive", "tactique_offensive", "tactique_defensive", "transition_offensive", "transition_defensive", "pressing", "cpa", "gardiennes", "endurance", "vitesse", "coordination", "developpement_individuel", "developpement_sectoriel", "developpement_collectif"] as const;

export async function quickCreateExercise(title: string, category: string): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  const v = z.object({ title: z.string().trim().min(2, "Titre requis").max(120), category: z.enum(CATEGORIES, "Catégorie requise") }).safeParse({ title, category });
  if (!v.success) return fieldErrors(v.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").insert({ club_id: ctx.clubId, ...v.data, created_by: ctx.userId }).select("id").single();
  if (error || !data) return fail(error?.code === "23505" ? "Un exercice porte déjà ce titre." : dbError(error, "Création refusée."));
  revalidatePath("/entrainement/exercices", "layout");
  return { ok: true, id: data.id };
}

const exercisePatch = z
  .object({
    title: z.string().trim().min(2).max(120),
    category: z.enum(CATEGORIES),
    objective: txt(1000), organisation: txt(3000), progression: txt(3000), instructions: txt(3000), constraints: txt(2000),
    realisation_criteria: txt(2000), success_criteria: txt(2000), coaching_points: txt(2000), variables: txt(2000), corrections: txt(2000),
    players_count: txt(60), dimensions: txt(60), duration_min: int(1, 180), series: int(1, 50), repetitions: txt(60), recovery: txt(60),
    equipment: txt(1000), video_links: z.array(link).max(20), diagram_id: uuid.nullable(),
  })
  .partial();
export async function saveExercisePatch(id: string, patch: z.input<typeof exercisePatch>): Promise<Result<{ savedAt: string }>> {
  await requirePermission("planning.write");
  const v = exercisePatch.safeParse(patch);
  if (!v.success) return fieldErrors(v.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").update(v.data).eq("id", id).select("updated_at");
  if (error || !data?.length) return fail(error?.code === "23505" ? "Un exercice porte déjà ce titre." : dbError(error, "Enregistrement refusé."));
  revalidatePath("/entrainement", "layout");
  return { ok: true, savedAt: data[0].updated_at };
}

// ------------------------------------------------------------------ Schémas tactiques
export async function saveDiagram(id: string | null, title: string, data: unknown, attach?: { exerciseId?: string; itemId?: string }): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  const t = z.string().trim().min(2, "Titre du schéma requis").max(120).safeParse(title);
  if (!t.success) return fail(t.error.issues[0].message);
  const d = parseDiagram(data);
  if (!d) return fail("Schéma invalide.");
  const supabase = await createClient();
  let diagramId = id;
  if (id) {
    const { data: up, error } = await supabase.from("tactical_diagrams").update({ title: t.data, data: d as never }).eq("id", id).select("id");
    if (error || !up?.length) return fail(dbError(error, "Enregistrement refusé."));
  } else {
    const { data: ins, error } = await supabase.from("tactical_diagrams").insert({ club_id: ctx.clubId, title: t.data, data: d as never, created_by: ctx.userId }).select("id").single();
    if (error || !ins) return fail(dbError(error, "Enregistrement refusé."));
    diagramId = ins.id;
  }
  if (attach?.exerciseId) {
    const { error } = await supabase.from("exercises").update({ diagram_id: diagramId }).eq("id", attach.exerciseId);
    if (error) return fail(dbError(error, "Association à l'exercice refusée."));
  }
  if (attach?.itemId) {
    const { error } = await supabase.from("session_exercises").update({ diagram_id: diagramId }).eq("id", attach.itemId);
    if (error) return fail(dbError(error, "Association à la séance refusée."));
  }
  revalidatePath("/entrainement", "layout");
  return { ok: true, id: diagramId! };
}

export async function duplicateDiagram(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requirePermission("planning.write");
  const supabase = await createClient();
  const { data: d } = await supabase.from("tactical_diagrams").select("title, data").eq("id", id).maybeSingle();
  if (!d) return fail("Schéma introuvable.");
  const { data, error } = await supabase.from("tactical_diagrams").insert({ club_id: ctx.clubId, title: `${d.title} (copie)`.slice(0, 120), data: d.data, created_by: ctx.userId }).select("id").single();
  if (error || !data) return fail(dbError(error, "Duplication refusée."));
  revalidatePath("/entrainement/schemas");
  return { ok: true, id: data.id };
}

export async function archiveDiagram(id: string): Promise<Result> {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("tactical_diagrams").update({ archived_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Action refusée."));
  revalidatePath("/entrainement/schemas");
  return { ok: true };
}

// ------------------------------------------------------------------ Matériel
const equipSchema = z.array(z.object({ item: z.string().trim().min(1).max(80), quantity: z.number().int().min(0).max(999) })).max(40);
export async function saveEquipment(sessionId: string, rows: z.input<typeof equipSchema>): Promise<Result> {
  const ctx = await requirePermission("planning.write");
  const v = equipSchema.safeParse(rows);
  if (!v.success) return fail("Liste de matériel invalide.");
  const names = v.data.map((r) => r.item.toLowerCase());
  if (new Set(names).size !== names.length) return fail("Un même matériel apparaît deux fois.");
  const supabase = await createClient();
  const { error: delErr } = await supabase.from("session_equipment").delete().eq("session_id", sessionId);
  if (delErr) return fail(dbError(delErr, "Enregistrement refusé."));
  if (v.data.length) {
    const { error } = await supabase.from("session_equipment").insert(v.data.map((r, k) => ({ club_id: ctx.clubId, session_id: sessionId, item: r.item, quantity: r.quantity, sort_order: k })));
    if (error) return fail(dbError(error, "Enregistrement refusé."));
  }
  touch(sessionId);
  return { ok: true };
}

// ------------------------------------------------------------------ Présences, participation et charge
const ATT = ["present", "retard", "absente_justifiee", "absente_non_justifiee", "blessee", "dispensee"] as const;
const attSchema = z.array(
  z.object({
    player_id: uuid,
    status: z.enum(ATT).nullable(),
    participation: z.enum(["complete", "adaptee", "partielle", "aucune"]).nullable(),
    minutes: int(0, 300),
    rpe: int(0, 10),
    note: txt(300),
  }),
).max(80);

export async function saveAttendanceRows(sessionId: string, rows: z.input<typeof attSchema>): Promise<Result<{ count: number }>> {
  const ctx = await requirePermission("planning.write");
  const v = attSchema.safeParse(rows);
  if (!v.success) return fail("Saisie invalide : vérifiez les minutes (0 à 300) et le RPE (0 à 10).");
  for (const r of v.data) {
    if (!r.status && (r.minutes != null || r.rpe != null)) return fail("Indiquez d'abord la présence avant les minutes ou le RPE.");
    if (r.status && ["absente_justifiee", "absente_non_justifiee"].includes(r.status) && (r.minutes || r.rpe)) return fail("Une joueuse absente ne peut pas avoir de minutes ni de RPE.");
  }
  const supabase = await createClient();
  const set = v.data.filter((r) => r.status);
  const clear = v.data.filter((r) => !r.status).map((r) => r.player_id);
  if (set.length) {
    const { error } = await supabase
      .from("training_attendance")
      .upsert(set.map((r) => ({ ...r, status: r.status!, club_id: ctx.clubId, session_id: sessionId, recorded_by: ctx.userId })), { onConflict: "session_id,player_id" });
    if (error) return fail(dbError(error, "Enregistrement des présences refusé."));
  }
  if (clear.length) await supabase.from("training_attendance").delete().eq("session_id", sessionId).in("player_id", clear);
  touch(sessionId);
  revalidatePath("/effectif", "layout");
  return { ok: true, count: set.length };
}

// ------------------------------------------------------------------ Évaluation et bilan
const evalPatch = z
  .object({
    criteria: z.array(z.object({ label: z.string().trim().min(1).max(80), score: z.number().int().min(1).max(5).nullable() })).max(20),
    appreciation: z.enum(["insuffisant", "passable", "satisfaisant", "tres_satisfaisant", "excellent"]).nullable(),
    objectives_reached: int(1, 5),
    engagement: int(1, 5),
    intensity_observed: z.enum(["repos", "faible", "moderee", "elevee", "maximale"]).nullable(),
    actual_duration_min: int(1, 300),
    strengths: txt(2000), improvements: txt(2000), difficulties: txt(2000), corrections: txt(2000), next_objective: txt(1000),
  })
  .partial();
export async function saveEvaluationPatch(sessionId: string, patch: z.input<typeof evalPatch>): Promise<Result<{ savedAt: string }>> {
  const ctx = await requirePermission("planning.write");
  const v = evalPatch.safeParse(patch);
  if (!v.success) return fieldErrors(v.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_evaluations")
    .upsert({ ...v.data, club_id: ctx.clubId, session_id: sessionId, evaluated_by: ctx.userId } as never, { onConflict: "session_id" })
    .select("updated_at");
  if (error || !data?.length) return fail(dbError(error, "Enregistrement refusé."));
  touch(sessionId);
  return { ok: true, savedAt: (data[0] as { updated_at: string }).updated_at };
}

// ------------------------------------------------------------------ Suppression
export async function deleteSessionById(id: string): Promise<Result> {
  await requirePermission("planning.write");
  const supabase = await createClient();
  const { data, error } = await supabase.from("training_sessions").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(dbError(error, "Suppression refusée (une séance validée ne peut être supprimée que par un valideur)."));
  touch();
  return { ok: true };
}

// ------------------------------------------------------------------ Programme de la semaine (export)
export type WeekRow = { date: string; kind: "seance" | "match"; number?: number; starts_at: string | null; ends_at: string | null; title: string; objective: string | null; duration: number | null; planned_rpe: number | null; status?: string; location: string | null };
export async function weekSummary(sessionId: string): Promise<Result<{ monday: string; rows: WeekRow[] }>> {
  const ctx = await requirePermission("planning.read");
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions").select("session_date, team_id").eq("id", sessionId).maybeSingle();
  if (!s) return fail("Séance introuvable.");
  const monday = mondayOf(s.session_date);
  const sunday = new Date(`${monday}T12:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const end = sunday.toISOString().slice(0, 10);
  const [{ data: sessions }, matches] = await Promise.all([
    supabase.from("training_sessions").select("number, session_date, starts_at, ends_at, theme, main_objective, planned_rpe, status, location, session_exercises(duration_min, series, recovery_sec, pause_after_min), session_phases(duration_min, id)")
      .eq("team_id", s.team_id).gte("session_date", monday).lte("session_date", end).order("session_date").order("starts_at"),
    ctx.permissions.has("matches.read")
      ? supabase.from("matches").select("kickoff_at, venue, home_away, opponents(name)").eq("club_id", ctx.clubId).gte("kickoff_at", `${monday}T00:00:00Z`).lt("kickoff_at", `${end}T23:59:59Z`)
      : Promise.resolve({ data: [] }),
  ]);
  const rows: WeekRow[] = (sessions ?? []).map((x) => {
    const work = (x.session_exercises ?? []).reduce((a, i) => {
      const n = Math.max(1, i.series ?? 1);
      return a + (i.duration_min ?? 0) * n + ((n - 1) * (i.recovery_sec ?? 0)) / 60 + (i.pause_after_min ?? 0);
    }, 0);
    return { date: x.session_date, kind: "seance", number: x.number, starts_at: x.starts_at, ends_at: x.ends_at, title: x.theme ?? "Séance", objective: x.main_objective, duration: Math.round(work) || null, planned_rpe: x.planned_rpe, status: x.status, location: x.location };
  });
  for (const m of (matches.data ?? []) as unknown as { kickoff_at: string; venue: string | null; home_away: string; opponents: { name: string } | null }[]) {
    const d = new Date(m.kickoff_at);
    rows.push({ date: m.kickoff_at.slice(0, 10), kind: "match", starts_at: d.toISOString().slice(11, 16), ends_at: null, title: `Match ${m.home_away === "exterieur" ? "à" : "contre"} ${m.opponents?.name ?? "adversaire"}`, objective: null, duration: null, planned_rpe: null, location: m.venue });
  }
  rows.sort((a, b) => (a.date + (a.starts_at ?? "")).localeCompare(b.date + (b.starts_at ?? "")));
  return { ok: true, monday, rows };
}
