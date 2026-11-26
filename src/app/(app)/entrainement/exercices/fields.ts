import type { FieldDef } from "@/components/phase2/auto-form";
import { CATEGORY_LABELS } from "@/lib/phase2/labels";

type V = Record<string, string | number | null | undefined>;
export const exerciseFields = (v: V = {}): FieldDef[] => [
  { name: "title", label: "Titre", required: true, defaultValue: v.title, span: 2, maxLength: 120 },
  { name: "category", label: "Catégorie", type: "select", required: true, options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })), defaultValue: v.category ?? "technique_offensive" },
  { name: "objective", label: "Objectif", type: "textarea", span: 3, defaultValue: v.objective, maxLength: 1000 },
  { name: "organisation", label: "Organisation", type: "textarea", span: 3, defaultValue: v.organisation, maxLength: 3000, rows: 4 },
  { name: "dimensions", label: "Dimensions", defaultValue: v.dimensions, placeholder: "Ex. 40 x 30 m" },
  { name: "players_count", label: "Nombre de joueuses", defaultValue: v.players_count, placeholder: "Ex. 8 c 8 + 2 GB" },
  { name: "duration_min", label: "Durée (min)", type: "number", min: 1, max: 180, defaultValue: v.duration_min },
  { name: "repetitions", label: "Répétitions", defaultValue: v.repetitions, placeholder: "Ex. 4 x 4 min" },
  { name: "recovery", label: "Récupération", defaultValue: v.recovery, placeholder: "Ex. 1 min 30 passive" },
  { name: "video_url", label: "Lien vidéo (https)", type: "url", defaultValue: v.video_url },
  { name: "instructions", label: "Consignes", type: "textarea", span: 3, defaultValue: v.instructions, maxLength: 3000, rows: 4 },
  { name: "success_criteria", label: "Critères de réussite", type: "textarea", span: 3, defaultValue: v.success_criteria, maxLength: 2000 },
  { name: "variables", label: "Variables (évolutions / régressions)", type: "textarea", span: 3, defaultValue: v.variables, maxLength: 2000 },
  { name: "corrections", label: "Corrections attendues", type: "textarea", span: 3, defaultValue: v.corrections, maxLength: 2000 },
  { name: "diagram", label: "Schéma (image)", type: "file", accept: "image/png,image/jpeg,image/webp", hint: "PNG, JPEG ou WebP, 3 Mo maximum. Remplace le schéma existant." },
];
