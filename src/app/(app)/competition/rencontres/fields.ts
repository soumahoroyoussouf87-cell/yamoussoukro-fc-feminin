import type { FieldDef, Option } from "@/components/phase2/auto-form";
import { HOME_AWAY_LABELS } from "@/lib/phase2/labels";

type V = Record<string, string | number | null | undefined>;
export function matchFields(opponents: Option[], competitions: Option[], v: V = {}, full = false): FieldDef[] {
  const base: FieldDef[] = [
    { name: "opponent_id", label: "Adversaire", type: "select", emptyOption: opponents.length ? "Choisir…" : "Aucun adversaire enregistré", options: opponents, defaultValue: v.opponent_id },
    { name: "new_opponent", label: "… ou nouvel adversaire", placeholder: "Nom du club adverse", maxLength: 80, hint: "Créé automatiquement s'il n'existe pas." },
    { name: "competition_id", label: "Compétition", type: "select", emptyOption: "Compétition active", options: competitions, defaultValue: v.competition_id },
    { name: "match_date", label: "Date", type: "date", required: true, defaultValue: v.match_date },
    { name: "match_time", label: "Coup d'envoi (heure d'Abidjan)", type: "time", defaultValue: v.match_time ?? "15:00" },
    { name: "home_away", label: "Lieu", type: "select", required: true, options: Object.entries(HOME_AWAY_LABELS).map(([value, label]) => ({ value, label })), defaultValue: v.home_away ?? "domicile" },
    { name: "venue", label: "Stade", defaultValue: v.venue },
    { name: "matchday", label: "Journée / tour", defaultValue: v.matchday, placeholder: "Ex. J5" },
    { name: "duration_min", label: "Durée réglementaire (min)", type: "number", min: 20, max: 130, defaultValue: v.duration_min ?? 90 },
  ];
  if (!full) return base;
  return [
    ...base,
    { name: "meeting_time", label: "Rendez-vous (date et heure)", type: "datetime-local", defaultValue: v.meeting_time },
    { name: "meeting_place", label: "Lieu de rendez-vous", defaultValue: v.meeting_place },
    { name: "referee", label: "Arbitre", defaultValue: v.referee },
    { name: "objectives", label: "Objectifs du match", type: "textarea", span: 3, defaultValue: v.objectives, maxLength: 2000 },
    { name: "game_plan", label: "Plan de jeu", type: "textarea", span: 3, defaultValue: v.game_plan, maxLength: 4000, rows: 5 },
    { name: "briefing", label: "Causerie / briefing", type: "textarea", span: 3, defaultValue: v.briefing, maxLength: 4000, rows: 4 },
    { name: "logistics", label: "Logistique", type: "textarea", span: 3, defaultValue: v.logistics, maxLength: 2000 },
  ];
}
