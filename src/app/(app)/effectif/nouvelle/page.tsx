import { requirePermission } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { getPositions } from "@/lib/data/players";
import { PageHeader } from "@/components/ui/page-header";
import { PlayerForm } from "@/components/players/player-form";
import { createPlayer } from "../actions";

export const metadata = { title: "Nouvelle joueuse" };

export default async function NewPlayerPage() {
  const ctx = await requirePermission("players.write");
  const [club, positions] = await Promise.all([getClubHeader(ctx), getPositions()]);
  return (
    <>
      <PageHeader eyebrow="Effectif" title="Nouvelle joueuse" description="Seules des informations réelles et vérifiées doivent être saisies." />
      <PlayerForm action={createPlayer} positions={positions} hasSeason={!!club.season} cancelHref="/effectif" submitLabel="Créer la fiche" />
    </>
  );
}
