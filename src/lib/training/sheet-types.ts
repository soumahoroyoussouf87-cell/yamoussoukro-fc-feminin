/** Données complètes d'une fiche de séance, sérialisables (assistant, aperçu et exports). */
import type { Diagram } from "./diagram";
import type { Criterion } from "./evaluation";

export type VideoLink = { title: string; url: string };

export type SheetExercise = {
  id: string;
  title: string;
  category: string;
  objective: string | null;
  organisation: string | null;
  progression: string | null;
  instructions: string | null;
  constraints: string | null;
  realisation_criteria: string | null;
  success_criteria: string | null;
  coaching_points: string | null;
  variables: string | null;
  corrections: string | null;
  players_count: string | null;
  dimensions: string | null;
  duration_min: number | null;
  series: number | null;
  repetitions: string | null;
  recovery: string | null;
  equipment: string | null;
  video_links: VideoLink[];
  diagram_id: string | null;
  diagram_image: string | null;
};

export type SheetItem = {
  id: string;
  exercise_id: string;
  duration_min: number | null;
  series: number | null;
  recovery_sec: number | null;
  pause_after_min: number | null;
  repetitions: string | null;
  recovery: string | null;
  notes: string | null;
  diagram_id: string | null;
  exercise: SheetExercise;
};

export type SheetPhase = { id: string; title: string; block: string | null; duration_min: number | null; notes: string | null; items: SheetItem[] };

export type SheetPlayer = {
  id: string;
  name: string;
  short: string;
  shirt: number | null;
  position: string | null;
  line: string | null;
  availability: string | null;
};

export type SheetAttendance = { player_id: string; status: string; participation: string | null; minutes: number | null; rpe: number | null; srpe: number | null; note: string | null };

export type SheetEvaluation = {
  criteria: Criterion[];
  appreciation: string | null;
  objectives_reached: number | null;
  engagement: number | null;
  intensity_observed: string | null;
  actual_duration_min: number | null;
  strengths: string | null;
  improvements: string | null;
  difficulties: string | null;
  corrections: string | null;
  next_objective: string | null;
  updated_at: string | null;
};

export type SheetSession = {
  id: string;
  number: number;
  status: string;
  session_date: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  period: string | null;
  game_system: string | null;
  audience: string | null;
  responsible_staff_id: string | null;
  responsible: string | null;
  weather: string | null;
  pitch_condition: string | null;
  theme: string | null;
  sub_theme: string | null;
  theme_id: string | null;
  sub_theme_id: string | null;
  main_objective: string | null;
  secondary_objectives: string | null;
  specific_objectives: string[];
  intensity: string | null;
  planned_rpe: number | null;
  notes: string | null;
  legacy_equipment: string | null;
  video_links: VideoLink[];
  wizard_step: number;
  validated_at: string | null;
  validated_by_name: string | null;
  published_at: string | null;
  updated_at: string;
  match_ref: string | null;
};

export type SheetData = {
  club: { name: string; season: string | null };
  session: SheetSession;
  phases: SheetPhase[];
  equipment: { item: string; quantity: number }[];
  players: SheetPlayer[];
  attendance: SheetAttendance[];
  evaluation: SheetEvaluation | null;
  diagrams: Record<string, { id: string; title: string; data: Diagram }>;
};
