import type { AccessContext } from "@/lib/auth";
import { listSquad } from "@/lib/data/players";
import type { RosterEntry } from "@/components/training/tactical-board";

/** Nom court affiché sous un pion : « A. KONÉ ». */
export function shortName(first: string, last: string) {
  return `${first.trim().charAt(0).toUpperCase()}. ${last.trim().toUpperCase()}`.slice(0, 24);
}

/** Effectif actif (numéro de la saison en cours) pour le tableau tactique. */
export async function loadRoster(ctx: AccessContext): Promise<RosterEntry[]> {
  const squad = await listSquad(ctx);
  return squad
    .map((p) => ({ id: p.id, name: shortName(p.first_name, p.last_name), number: p.shirt_number }))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "fr"));
}
