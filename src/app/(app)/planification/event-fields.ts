import type { FieldDef, Option } from "@/components/phase2/auto-form";
import { EVENT_TYPE_LABELS, INTENSITY_LABELS } from "@/lib/phase2/labels";

const opts = (m: Record<string, string>): Option[] => Object.entries(m).map(([value, label]) => ({ value, label }));

export function eventFields(staff: Option[], v: Record<string, string | null | undefined> = {}): FieldDef[] {
  return [
    { name: "type", label: "Type d'activité", type: "select", required: true, options: opts(EVENT_TYPE_LABELS), defaultValue: v.type ?? "reunion" },
    { name: "title", label: "Titre", required: true, defaultValue: v.title, span: 2, maxLength: 120, placeholder: "Ex. Séance vidéo collective" },
    { name: "event_date", label: "Date", type: "date", required: true, defaultValue: v.event_date },
    { name: "starts_at", label: "Début", type: "time", defaultValue: v.starts_at?.slice(0, 5) },
    { name: "ends_at", label: "Fin", type: "time", defaultValue: v.ends_at?.slice(0, 5) },
    { name: "location", label: "Lieu", defaultValue: v.location },
    { name: "theme", label: "Thème", defaultValue: v.theme },
    { name: "sub_theme", label: "Sous-thème", defaultValue: v.sub_theme },
    { name: "intensity", label: "Intensité", type: "select", options: opts(INTENSITY_LABELS), emptyOption: "—", defaultValue: v.intensity },
    { name: "responsible_staff_id", label: "Responsable", type: "select", options: staff, emptyOption: "—", defaultValue: v.responsible_staff_id },
    { name: "audience", label: "Public concerné", defaultValue: v.audience, placeholder: "Ex. Groupe complet, défenseures…" },
    { name: "objective", label: "Objectif", type: "textarea", span: 3, defaultValue: v.objective, maxLength: 1000 },
    { name: "notes", label: "Remarques", type: "textarea", span: 3, defaultValue: v.notes, maxLength: 2000 },
  ];
}
