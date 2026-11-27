import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getScope, listMatches, listPlayerOptions } from "@/lib/phase2/data";
import { addDays, matchDayLabel } from "@/lib/domain/match-day";
import { dayOf } from "@/lib/phase2/labels";
import { parseDiagram, type Diagram } from "./diagram";
import { parseCriteria } from "./evaluation";
import type { SheetData, SheetExercise, VideoLink } from "./sheet-types";

const links = (raw: unknown): VideoLink[] =>
  Array.isArray(raw) ? raw.filter((l): l is VideoLink => !!l && typeof l === "object" && typeof (l as VideoLink).url === "string").map((l) => ({ title: String(l.title ?? ""), url: l.url })) : [];

const EX_COLS =
  "id, title, category, objective, organisation, progression, instructions, constraints, realisation_criteria, success_criteria, coaching_points, variables, corrections, players_count, dimensions, duration_min, series, repetitions, recovery, equipment, video_links, diagram_id, diagram_path";

type RawExercise = Omit<SheetExercise, "video_links" | "diagram_image"> & { video_links: unknown; diagram_path: string | null };

/** Charge la fiche complète d'une séance (null si introuvable ou non autorisée par RLS). */
export async function loadSheet(ctx: AccessContext, id: string): Promise<SheetData | null> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select(`*, staff_members(first_name, last_name), session_phases(*), session_exercises(*, exercises(${EX_COLS})), session_equipment(item, quantity, sort_order), training_attendance(player_id, status, participation, minutes, rpe, srpe, note), session_evaluations(*)`)
    .eq("id", id)
    .maybeSingle();
  if (!s) return null;
  const scope = await getScope(ctx);

  const rawItems = (s.session_exercises ?? []) as unknown as (Record<string, unknown> & { phase_id: string | null; sort_order: number; exercises: RawExercise | null; diagram_id: string | null })[];
  // Schémas tactiques (exercice ou spécifiques à la séance) et images héritées.
  const diagramIds = new Set<string>();
  for (const i of rawItems) {
    if (i.diagram_id) diagramIds.add(i.diagram_id);
    if (i.exercises?.diagram_id) diagramIds.add(i.exercises.diagram_id);
  }
  const imagePaths = [...new Set(rawItems.map((i) => i.exercises?.diagram_path).filter((p): p is string => !!p))];
  const [{ data: diagrams }, signed, players, matches, validator] = await Promise.all([
    diagramIds.size ? supabase.from("tactical_diagrams").select("id, title, data").in("id", [...diagramIds]) : Promise.resolve({ data: [] as { id: string; title: string; data: unknown }[] }),
    imagePaths.length ? supabase.storage.from("exercise-diagrams").createSignedUrls(imagePaths, 60 * 60) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    listPlayerOptions(ctx),
    listMatches(ctx, { from: addDays(s.session_date, -2), to: addDays(s.session_date, 7) }),
    s.validated_by ? supabase.from("profiles").select("full_name").eq("id", s.validated_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const imageUrl = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]));
  const diagramMap: SheetData["diagrams"] = {};
  for (const d of diagrams ?? []) {
    const parsed = parseDiagram(d.data);
    if (parsed) diagramMap[d.id] = { id: d.id, title: d.title, data: parsed as Diagram };
  }

  const toExercise = (e: RawExercise): SheetExercise => {
    const { diagram_path, video_links, ...rest } = e;
    return { ...rest, video_links: links(video_links), diagram_image: diagram_path ? imageUrl.get(diagram_path) ?? null : null };
  };

  const phases = [...(s.session_phases ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.id,
      title: p.title,
      block: p.block,
      duration_min: p.duration_min,
      notes: p.notes,
      items: rawItems
        .filter((i) => i.phase_id === p.id && i.exercises)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          id: i.id as string,
          exercise_id: i.exercise_id as string,
          duration_min: i.duration_min as number | null,
          series: i.series as number | null,
          recovery_sec: i.recovery_sec as number | null,
          pause_after_min: i.pause_after_min as number | null,
          repetitions: i.repetitions as string | null,
          recovery: i.recovery as string | null,
          notes: i.notes as string | null,
          diagram_id: i.diagram_id,
          exercise: toExercise(i.exercises!),
        })),
    }));

  const ev = Array.isArray(s.session_evaluations) ? s.session_evaluations[0] : s.session_evaluations;
  const matchDates = matches.map((m) => dayOf(m.kickoff_at));

  return {
    club: { name: scope.club.name, season: scope.club.season?.label ?? null },
    session: {
      id: s.id,
      number: s.number,
      status: s.status,
      session_date: s.session_date,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      location: s.location,
      period: s.period,
      game_system: s.game_system,
      audience: s.audience,
      responsible_staff_id: s.responsible_staff_id,
      responsible: s.staff_members ? `${s.staff_members.first_name} ${s.staff_members.last_name}` : null,
      weather: s.weather,
      pitch_condition: s.pitch_condition,
      theme: s.theme,
      sub_theme: s.sub_theme,
      theme_id: s.theme_id,
      sub_theme_id: s.sub_theme_id,
      main_objective: s.main_objective,
      secondary_objectives: s.secondary_objectives,
      specific_objectives: s.specific_objectives ?? [],
      intensity: s.intensity,
      planned_rpe: s.planned_rpe,
      notes: s.notes,
      legacy_equipment: s.equipment,
      video_links: links(s.video_links),
      wizard_step: s.wizard_step,
      validated_at: s.validated_at,
      validated_by_name: (validator.data as { full_name: string | null } | null)?.full_name ?? null,
      published_at: s.published_at,
      updated_at: s.updated_at,
      match_ref: matchDayLabel(s.session_date, matchDates),
    },
    phases,
    equipment: [...(s.session_equipment ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((e) => ({ item: e.item, quantity: e.quantity })),
    players: players.map((p) => ({ id: p.id, name: p.name, short: p.short, shirt: p.shirt, position: p.position, line: p.line, availability: p.availability })),
    attendance: (s.training_attendance ?? []).map((a) => ({ ...a })),
    evaluation: ev
      ? {
          criteria: parseCriteria(ev.criteria),
          appreciation: ev.appreciation,
          objectives_reached: ev.objectives_reached,
          engagement: ev.engagement,
          intensity_observed: ev.intensity_observed,
          actual_duration_min: ev.actual_duration_min,
          strengths: ev.strengths,
          improvements: ev.improvements,
          difficulties: ev.difficulties,
          corrections: ev.corrections,
          next_objective: ev.next_objective,
          updated_at: ev.updated_at,
        }
      : null,
    diagrams: diagramMap,
  };
}
