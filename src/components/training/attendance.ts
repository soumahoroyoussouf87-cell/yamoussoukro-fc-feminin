"use client";

import { useState } from "react";
import { saveAttendanceRows } from "@/lib/training/actions";
import type { SheetData } from "@/lib/training/sheet-types";
import { useAutosave } from "./autosave";

export type AttRow = { player_id: string; status: string | null; participation: string | null; minutes: number | null; rpe: number | null; note: string | null };
export const AVAILABILITY: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  disponible: { label: "Disponible", tone: "success" },
  incertaine: { label: "Incertaine", tone: "warning" },
  restreinte: { label: "Restreinte", tone: "warning" },
  indisponible: { label: "Indisponible", tone: "danger" },
};
export const ABSENT = ["absente_justifiee", "absente_non_justifiee"];

/** Lignes de présence de toutes les joueuses (saisies ou non), sauvegardées ensemble. */
export function useAttendance(data: SheetData) {
  const [rows, setRows] = useState<AttRow[]>(() => {
    const map = new Map(data.attendance.map((a) => [a.player_id, a]));
    return data.players.map((p) => {
      const a = map.get(p.id);
      return { player_id: p.id, status: a?.status ?? null, participation: a?.participation ?? null, minutes: a?.minutes ?? null, rpe: a?.rpe ?? null, note: a?.note ?? null };
    });
  });
  const save = useAutosave((p: { rows: AttRow[] }) => saveAttendanceRows(data.session.id, p.rows as never), { delay: 1200 });
  const update = (fn: (r: AttRow[]) => AttRow[]) =>
    setRows((r) => {
      const next = fn(r);
      save.queue({ rows: next });
      return next;
    });
  const patch = (playerId: string, p: Partial<AttRow>) => update((r) => r.map((x) => (x.player_id === playerId ? normalize({ ...x, ...p }) : x)));
  return { rows, update, patch, state: save.state };
}

/** Une absente n'a ni participation, ni minutes, ni RPE. */
export function normalize(r: AttRow): AttRow {
  if (!r.status) return { ...r, participation: null, minutes: null, rpe: null };
  if (ABSENT.includes(r.status)) return { ...r, participation: "aucune", minutes: null, rpe: null };
  return r;
}
