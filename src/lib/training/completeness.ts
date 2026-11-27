/** Contrôle de complétude de la fiche, étape par étape (barre de progression et validation). */
import type { SheetData } from "./sheet-types";
import { computeSchedule, plannedMinutes } from "./schedule";

export const STEPS = [
  { n: 1, short: "Infos", label: "Informations générales" },
  { n: 2, short: "Thèmes", label: "Thèmes et objectifs" },
  { n: 3, short: "Construction", label: "Construction de la séance" },
  { n: 4, short: "Exercices", label: "Exercices et tableau tactique" },
  { n: 5, short: "Effectif", label: "Effectif et matériel" },
  { n: 6, short: "Charge", label: "Charge et analyse vidéo" },
  { n: 7, short: "Évaluation", label: "Évaluation et bilan" },
  { n: 8, short: "Validation", label: "Validation et exportation" },
] as const;

export type Check = { step: number; label: string; ok: boolean; required: boolean };

export function sheetChecks(d: SheetData, today: string): Check[] {
  const s = d.session;
  const items = d.phases.flatMap((p) => p.items);
  const sched = computeSchedule(d.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items })));
  const planned = plannedMinutes(s.starts_at, s.ends_at);
  const past = s.session_date <= today;
  return [
    { step: 1, label: "Date, heure de début et heure de fin", ok: !!(s.session_date && s.starts_at && s.ends_at), required: true },
    { step: 1, label: "Lieu de la séance", ok: !!s.location, required: true },
    { step: 1, label: "Responsable de la séance", ok: !!s.responsible_staff_id, required: false },
    { step: 2, label: "Thème principal", ok: !!(s.theme_id || s.theme), required: true },
    { step: 2, label: "Objectif principal", ok: !!s.main_objective, required: true },
    { step: 3, label: "Au moins une phase avec un exercice", ok: d.phases.some((p) => p.items.length > 0), required: true },
    { step: 3, label: "Durée de chaque exercice renseignée", ok: items.length > 0 && items.every((i) => !!i.duration_min), required: true },
    {
      step: 3,
      label: planned ? `Durée des exercices compatible avec l'horaire (${planned} min prévues)` : "Durée des exercices compatible avec l'horaire",
      ok: !planned || (sched.total > 0 && sched.total <= planned),
      required: false,
    },
    { step: 4, label: "Consignes ou organisation pour chaque exercice", ok: items.length > 0 && items.every((i) => !!(i.exercise.instructions || i.exercise.organisation)), required: true },
    { step: 4, label: "Schéma tactique pour chaque exercice", ok: items.length > 0 && items.every((i) => !!(i.diagram_id || i.exercise.diagram_id || i.exercise.diagram_image)), required: false },
    { step: 5, label: "Matériel listé", ok: d.equipment.length > 0, required: false },
    { step: 5, label: "Présences saisies", ok: d.attendance.length > 0, required: past },
    { step: 6, label: "RPE prévu (charge planifiée)", ok: !!s.planned_rpe, required: false },
    { step: 6, label: "RPE individuel saisi pour les présentes", ok: d.attendance.some((a) => a.rpe != null), required: false },
    { step: 7, label: "Évaluation de la séance", ok: !!d.evaluation && (d.evaluation.criteria.some((c) => c.score != null) || !!d.evaluation.appreciation), required: past },
  ];
}

export function progress(checks: Check[]) {
  const done = checks.filter((c) => c.ok).length;
  return { done, total: checks.length, pct: checks.length ? Math.round((done / checks.length) * 100) : 0, missingRequired: checks.filter((c) => c.required && !c.ok) };
}
