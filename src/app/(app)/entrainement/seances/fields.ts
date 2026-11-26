import type { FieldDef, Option } from "@/components/phase2/auto-form";
import { INTENSITY_LABELS } from "@/lib/phase2/labels";
import { SYSTEMS } from "@/lib/domain/formations";

type V = Record<string, string | number | null | undefined>;
export const sessionFields = (staff: Option[], v: V = {}): FieldDef[] => [
  { name: "session_date", label: "Date", type: "date", required: true, defaultValue: v.session_date },
  { name: "starts_at", label: "Début", type: "time", defaultValue: typeof v.starts_at === "string" ? v.starts_at.slice(0, 5) : null },
  { name: "ends_at", label: "Fin", type: "time", defaultValue: typeof v.ends_at === "string" ? v.ends_at.slice(0, 5) : null },
  { name: "theme", label: "Thème", required: true, defaultValue: v.theme, maxLength: 120, placeholder: "Ex. Sortie de balle" },
  { name: "sub_theme", label: "Sous-thème", defaultValue: v.sub_theme, maxLength: 120 },
  { name: "location", label: "Lieu", defaultValue: v.location },
  { name: "intensity", label: "Intensité prévue", type: "select", emptyOption: "—", options: Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label })), defaultValue: v.intensity },
  { name: "game_system", label: "Système de jeu", type: "select", emptyOption: "—", options: SYSTEMS.map((s) => ({ value: s, label: s })), defaultValue: v.game_system },
  { name: "responsible_staff_id", label: "Responsable", type: "select", emptyOption: "—", options: staff, defaultValue: v.responsible_staff_id },
  { name: "audience", label: "Public concerné", defaultValue: v.audience, placeholder: "Ex. Groupe complet" },
  { name: "main_objective", label: "Objectif principal", type: "textarea", span: 2, defaultValue: v.main_objective, maxLength: 1000 },
  { name: "secondary_objectives", label: "Objectifs secondaires", type: "textarea", span: 3, defaultValue: v.secondary_objectives, maxLength: 2000 },
  { name: "equipment", label: "Matériel", type: "textarea", span: 3, defaultValue: v.equipment, maxLength: 1000 },
  { name: "notes", label: "Remarques", type: "textarea", span: 3, defaultValue: v.notes, maxLength: 2000 },
];
