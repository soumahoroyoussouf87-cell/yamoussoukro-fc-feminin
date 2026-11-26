import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listPlayerOptions } from "@/lib/phase2/data";
import { computePlayerStats } from "@/lib/domain/player-stats";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Statistiques" };

export default async function StatsPage() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data: matches } = await supabase.from("matches").select("id, duration_min").eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000").eq("status", "joue");
  const ids = (matches ?? []).map((m) => m.id);
  const [{ data: lineups }, { data: events }, players] = await Promise.all([
    ids.length ? supabase.from("lineups").select("match_id, status, lineup_players(player_id, slot)").in("match_id", ids).neq("status", "provisoire") : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("match_events").select("match_id, type, minute, player_id, related_player_id").in("match_id", ids) : Promise.resolve({ data: [] }),
    listPlayerOptions(ctx),
  ]);
  const dur = new Map((matches ?? []).map((m) => [m.id, m.duration_min]));
  const stats = computePlayerStats(
    (lineups ?? []).map((l) => ({
      match_id: l.match_id, duration: dur.get(l.match_id) ?? 90,
      starters: (l.lineup_players ?? []).filter((p) => p.slot === "titulaire").map((p) => p.player_id),
      substitutes: (l.lineup_players ?? []).filter((p) => p.slot === "remplacante").map((p) => p.player_id),
    })),
    events ?? [],
  );
  const rows = players.map((p) => ({ p, s: stats.get(p.id) })).filter((r) => r.s).sort((a, b) => b.s!.minutes - a.s!.minutes || b.s!.goals - a.s!.goals);
  const missing = ids.length - (lineups ?? []).length;
  return (
    <>
      <PageHeader eyebrow="Compétition" title="Statistiques individuelles" description={`${ids.length} match(s) joué(s) cette saison. Temps de jeu calculé depuis la composition officielle et les remplacements / cartons rouges saisis ; buts, passes décisives et cartons depuis les événements.`} />
      {missing > 0 ? <p className="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">{missing} match(s) joué(s) sans composition officielle : leur temps de jeu n&apos;est pas compté.</p> : null}
      {rows.length === 0 ? (
        <Card className="p-4"><EmptyState icon={BarChart3} title="Aucune statistique" description="Elles apparaîtront après les premiers matchs joués (composition validée + événements saisis)." /></Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Joueuse</TH><TH className="text-center">Matchs</TH><TH className="text-center">Titulaire</TH><TH className="text-center">Entrées</TH><TH className="text-center">Minutes</TH><TH className="text-center">Buts</TH><TH className="text-center">Passes D.</TH><TH className="text-center">CJ</TH><TH className="text-center">CR</TH></TR></THead>
            <TBody>
              {rows.map(({ p, s }) => (
                <TR key={p.id}>
                  <TD><span className="font-display font-bold">{p.shirt ?? ""}</span> <span className="font-semibold">{p.name}</span> <span className="text-xs text-muted-foreground">{p.position ?? ""}</span></TD>
                  {[s!.played, s!.starts, s!.subAppearances, s!.minutes, s!.goals, s!.assists, s!.yellow, s!.red].map((n, i) => <TD key={i} className="text-center tabular-nums">{n}</TD>)}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
