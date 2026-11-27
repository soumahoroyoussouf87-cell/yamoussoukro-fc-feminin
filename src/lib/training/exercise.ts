import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { parseDiagram, type Diagram } from "./diagram";
import type { SheetExercise, VideoLink } from "./sheet-types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Exercice de la bibliothèque avec son schéma éditable (ou l'image héritée). */
export async function loadExercise(supabase: Client, id: string) {
  const { data: e } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!e) return null;
  const [{ data: d }, img] = await Promise.all([
    e.diagram_id ? supabase.from("tactical_diagrams").select("id, title, data").eq("id", e.diagram_id).maybeSingle() : Promise.resolve({ data: null }),
    e.diagram_path ? supabase.storage.from("exercise-diagrams").createSignedUrl(e.diagram_path, 3600) : Promise.resolve({ data: null }),
  ]);
  const parsed = d ? parseDiagram(d.data) : null;
  const links = Array.isArray(e.video_links) ? (e.video_links as unknown as VideoLink[]).filter((l) => l && typeof l.url === "string") : [];
  const exercise: SheetExercise = {
    id: e.id, title: e.title, category: e.category, objective: e.objective, organisation: e.organisation, progression: e.progression, instructions: e.instructions,
    constraints: e.constraints, realisation_criteria: e.realisation_criteria, success_criteria: e.success_criteria, coaching_points: e.coaching_points,
    variables: e.variables, corrections: e.corrections, players_count: e.players_count, dimensions: e.dimensions, duration_min: e.duration_min, series: e.series,
    repetitions: e.repetitions, recovery: e.recovery, equipment: e.equipment,
    video_links: e.video_url && !links.some((l) => l.url === e.video_url) ? [{ title: "Vidéo", url: e.video_url }, ...links] : links,
    diagram_id: e.diagram_id, diagram_image: (img.data as { signedUrl: string } | null)?.signedUrl ?? null,
  };
  return { exercise, archived: !!e.archived_at, diagram: d && parsed ? { id: d.id, title: d.title, data: parsed as Diagram } : null };
}
