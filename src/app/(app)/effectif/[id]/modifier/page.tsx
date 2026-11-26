import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { getPositions } from "@/lib/data/players";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PlayerForm } from "@/components/players/player-form";
import { updatePlayer } from "../../actions";

export const metadata = { title: "Modifier une fiche" };

export default async function EditPlayerPage({ params }: PageProps<"/effectif/[id]/modifier">) {
  const { id } = await params;
  const ctx = await requirePermission("players.write");
  const supabase = await createClient();
  const [club, positions, { data: p }] = await Promise.all([
    getClubHeader(ctx),
    getPositions(),
    supabase.from("players").select("*, player_positions(position_id, is_primary)").eq("id", id).maybeSingle(),
  ]);
  if (!p) notFound();
  const { data: season } = club.season
    ? await supabase.from("player_seasons").select("shirt_number, tactical_role").eq("player_id", id).eq("season_id", club.season.id).maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader eyebrow="Effectif" title={`Modifier — ${p.first_name} ${p.last_name}`} />
      <PlayerForm
        action={updatePlayer.bind(null, id)}
        positions={positions}
        hasSeason={!!club.season}
        cancelHref={`/effectif/${id}`}
        submitLabel="Enregistrer les modifications"
        initial={{
          ...p,
          shirt_number: season?.shirt_number ?? null,
          tactical_role: season?.tactical_role ?? null,
          primary_position: p.player_positions.find((x) => x.is_primary)?.position_id ?? null,
          secondary_positions: p.player_positions.filter((x) => !x.is_primary).map((x) => x.position_id),
        }}
      />
    </>
  );
}
