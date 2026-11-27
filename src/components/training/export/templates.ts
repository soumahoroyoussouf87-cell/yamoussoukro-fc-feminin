import type { WeekRow } from "@/lib/training/actions";

export type TemplateId = "complete" | "terrain" | "resume" | "bilan" | "exercice" | "semaine";
export type PaperSize = "A4" | "A3";
export type Orientation = "portrait" | "landscape";
export type ExportOptions = { template: TemplateId; size: PaperSize; orientation: Orientation; itemId?: string | null; week?: { monday: string; rows: WeekRow[] } | null; origin: string };

export const TEMPLATES: { id: TemplateId; label: string; description: string; orientation: Orientation }[] = [
  { id: "complete", label: "Fiche complète", description: "Toutes les informations, exercices avec schémas, charge, évaluation et validation.", orientation: "portrait" },
  { id: "terrain", label: "Fiche terrain", description: "Une page par exercice : schéma à gauche, consignes à droite.", orientation: "landscape" },
  { id: "resume", label: "Fiche résumée", description: "Une page : informations, déroulé et matériel.", orientation: "portrait" },
  { id: "bilan", label: "Compte rendu", description: "Présences, charge individuelle, évaluation et bilan du staff.", orientation: "portrait" },
  { id: "exercice", label: "Fiche exercice", description: "Un seul exercice avec son schéma et tout son contenu.", orientation: "landscape" },
  { id: "semaine", label: "Programme de la semaine", description: "Toutes les séances et rencontres de la semaine.", orientation: "landscape" },
];

