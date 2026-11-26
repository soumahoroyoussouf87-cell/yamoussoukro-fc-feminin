import type { FieldDef, Option } from "@/components/phase2/auto-form";

type V = Record<string, string | null | undefined>;
export const macroFields = (v: V = {}): FieldDef[] => [
  { name: "name", label: "Nom", required: true, defaultValue: v.name, placeholder: "Ex. Phase aller", span: 3 },
  { name: "starts_on", label: "Début", type: "date", required: true, defaultValue: v.starts_on },
  { name: "ends_on", label: "Fin", type: "date", required: true, defaultValue: v.ends_on },
  { name: "objective", label: "Objectif", type: "textarea", defaultValue: v.objective, span: 3, maxLength: 1000 },
];
export const mesoFields = (macros: Option[], v: V = {}): FieldDef[] => [
  { name: "macrocycle_id", label: "Macrocycle", type: "select", required: true, options: macros, defaultValue: v.macrocycle_id ?? macros[0]?.value },
  { name: "name", label: "Nom", required: true, defaultValue: v.name, placeholder: "Ex. Bloc 1 — Fondamentaux", span: 2 },
  { name: "starts_on", label: "Début", type: "date", required: true, defaultValue: v.starts_on },
  { name: "ends_on", label: "Fin", type: "date", required: true, defaultValue: v.ends_on },
  { name: "focus", label: "Dominante", defaultValue: v.focus, placeholder: "Ex. Pressing haut" },
  { name: "objective", label: "Objectif", type: "textarea", defaultValue: v.objective, span: 3, maxLength: 1000 },
];
