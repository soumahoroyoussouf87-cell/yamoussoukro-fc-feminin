import { SECTOR_LABELS } from "@/lib/performance/collective";
import type { Scope } from "@/components/development/labels";

export const todayISO = () => new Date().toISOString().slice(0, 10);
export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const dayFr = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

/** Personne ou groupe concerné par un plan. */
export function concerned(p: { scope: Scope; sector_code: string | null; player: { name: string } | string | null }) {
  if (p.scope === "individuel") return typeof p.player === "string" ? p.player : p.player?.name ?? "—";
  if (p.scope === "sectoriel") return `Secteur ${SECTOR_LABELS[p.sector_code ?? ""] ?? p.sector_code ?? ""}`.trim();
  return "Équipe";
}
