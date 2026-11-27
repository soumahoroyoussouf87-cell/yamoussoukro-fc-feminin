import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions } from "@/lib/phase2/data";
import { dayLong, dayOf, timeOf } from "@/lib/phase2/labels";
import { logoSrc } from "@/components/phase2/team-logo";
import { LineupPoster, type LineupPosterPlayer } from "@/components/phase2/lineup-poster";

export const metadata = { title: "Affiche du onze de départ" };

export default async function LineupPosterPage({ params, searchParams }: PageProps<"/impression/affiche-onze/[id]">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  // Même choix que l'impression : composition demandée, sinon la première validée, sinon la première.
  const { data: lineups } = await supabase.from("lineups").select("id, system, status").eq("match_id", id).order("created_at");
  const l = (lineups ?? []).find((x) => x.id === sp.compo) ?? (lineups ?? []).find((x) => x.status !== "provisoire") ?? (lineups ?? [])[0];
  const [{ data: lp }, options, { data: squad }] = await Promise.all([
    l ? supabase.from("lineup_players").select("player_id, slot, x, y, is_captain, sort_order").eq("lineup_id", l.id).order("sort_order") : Promise.resolve({ data: [] }),
    listPlayerOptions(ctx),
    supabase.from("match_squads").select("match_squad_players(player_id, shirt_number)").eq("match_id", id).maybeSingle(),
  ]);
  const rows = lp ?? [];
  const ids = rows.map((p) => p.player_id);
  const { data: photos } = ids.length ? await supabase.from("players").select("id, photo_path").in("id", ids) : { data: [] as { id: string; photo_path: string | null }[] };
  const hasPhoto = new Set((photos ?? []).filter((p) => p.photo_path).map((p) => p.id));
  const byId = new Map(options.map((p) => [p.id, p]));
  const squadShirt = new Map((squad?.match_squad_players ?? []).map((p) => [p.player_id, p.shirt_number]));
  const shirt = (pid: string) => squadShirt.get(pid) ?? byId.get(pid)?.shirt ?? null;

  const starters: LineupPosterPlayer[] = rows.filter((p) => p.slot === "titulaire").map((p) => ({
    id: p.player_id,
    firstName: byId.get(p.player_id)?.first_name ?? "",
    lastName: byId.get(p.player_id)?.last_name ?? "",
    shirt: shirt(p.player_id),
    // Photos servies par la route de l'affiche des convoquées (stockage privé, même origine).
    photo: hasPhoto.has(p.player_id) ? `/impression/affiche-convocation/${id}/photo/${p.player_id}` : null,
    x: p.x == null ? null : Number(p.x),
    y: p.y == null ? null : Number(p.y),
    captain: p.is_captain,
  }));
  const bench = rows.filter((p) => p.slot === "remplacante").map((p) => ({ id: p.player_id, lastName: byId.get(p.player_id)?.last_name ?? "", shirt: shirt(p.player_id) }));

  const day = dayOf(m.kickoff_at);
  const away = m.home_away === "exterieur";
  const yfc = { name: "Yamoussoukro FC", logo: "/brand/logo-officiel-yfc.png" };
  const opp = { name: m.opponents?.name ?? "Adversaire", logo: logoSrc(m.opponents?.logo_path) };
  return (
    <LineupPoster
      starters={starters}
      bench={bench}
      system={l?.system && l.system !== "Personnalisé" ? l.system : ""}
      draft={!l || l.status === "provisoire"}
      empty={!l ? "Aucune composition accessible pour ce match. Composez d'abord le onze dans l'onglet « Onze de départ »." : starters.length ? null : "Cette composition n'a encore aucune titulaire placée sur le terrain."}
      match={{
        id,
        day,
        kicker: [m.competitions?.name, m.matchday].filter(Boolean).join(" · "),
        dateLabel: `${dayLong(day)} · ${timeOf(m.kickoff_at)}`,
        venue: m.venue ?? null,
        home: away ? opp : yfc,
        away: away ? yfc : opp,
      }}
    />
  );
}
