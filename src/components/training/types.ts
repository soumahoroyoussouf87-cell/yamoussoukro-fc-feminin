import type { SheetData } from "@/lib/training/sheet-types";

export type Option = { value: string; label: string };
export type ThemeRow = { id: string; name: string; parent_id: string | null; archived: boolean };
export type LibraryRow = { id: string; title: string; category: string; duration_min: number | null };
export type HistoryRow = { id: number; from_status: string | null; to_status: string; created_at: string; actor: string };
export type Perms = { write: boolean; validate: boolean; editable: boolean; export: boolean };

export type StepProps = {
  data: SheetData;
  perms: Perms;
  today: string;
  staff: Option[];
  themes: ThemeRow[];
  library: LibraryRow[];
  templates: { id: string; name: string }[];
  history: HistoryRow[];
  /** Recharge les données du serveur après une modification structurelle. */
  refresh: () => void;
};
