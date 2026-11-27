import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions } from "@/lib/phase2/data";
import { dayLong, dayOf, timeOf } from "@/lib/phase2/labels";
import { logoSrc } from "@/components/phase2/team-logo";
import { SquadPoster, type PosterPlayer } from "@/components/phase2/squad-poster";

export const metadata = { title: "Affiche des convoquées" };

export default async function SquadPosterPage({ params }: PageProps<"/impression/affiche-convocation/[id]">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const { data: squad } = await supabase.from("match_squads").select("status, match_squad_players(player_id, status, shirt_number)").eq("match_id", id).maybeSingle();
  const convoked = (squad?.match_squad_players ?? []).filter((p) => p.status === "convoquee");
  const ids = convoked.map((p) => p.player_id);
  const [options, { data: photos }] = await Promise.all([
    listPlayerOptions(ctx),
    ids.length ? supabase.from("players").select("id, photo_path").in("id", ids) : Promise.resolve({ data: [] as { id: string; photo_path: string | null }[] }),
  ]);
  // Photos servies par la route voisine « photo/[player] » (stockage privé, même origine).
  const pathOf = new Map((photos ?? []).map((p) => [p.id, p.photo_path]));
  const byId = new Map(options.map((p) => [p.id, p]));

  const players: PosterPlayer[] = convoked
    .map((c) => {
      const pl = byId.get(c.player_id);
      const path = pathOf.get(c.player_id);
      return {
        id: c.player_id,
        firstName: pl?.first_name ?? "",
        lastName: pl?.last_name ?? "",
        shirt: c.shirt_number ?? pl?.shirt ?? null,
        position: pl?.position ?? null,
        photo: path ? `/impression/affiche-convocation/${id}/photo/${c.player_id}` : null,
        sort: pl?.sort ?? 999,
      };
    })
    .sort((a, b) => a.sort - b.sort || (a.shirt ?? 99) - (b.shirt ?? 99) || a.lastName.localeCompare(b.lastName));

  const day = dayOf(m.kickoff_at);
  const away = m.home_away === "exterieur";
  return (
    <SquadPoster
      players={players}
      validated={squad?.status === "valide" || squad?.status === "publie"}
      hasSquad={!!squad}
      match={{
        id,
        day,
        kicker: [m.competitions?.name, m.matchday].filter(Boolean).join(" · "),
        dateLabel: `${dayLong(day)} · ${timeOf(m.kickoff_at)}`,
        venue: m.venue ?? null,
        home: away ? { name: m.opponents?.name ?? "Adversaire", logo: logoSrc(m.opponents?.logo_path) } : { name: "Yamoussoukro FC", logo: "/brand/logo-officiel-yfc.png" },
        away: away ? { name: "Yamoussoukro FC", logo: "/brand/logo-officiel-yfc.png" } : { name: m.opponents?.name ?? "Adversaire", logo: logoSrc(m.opponents?.logo_path) },
      }}
    />
  );
}
