import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions } from "@/lib/phase2/data";
import { computePlayerStats } from "@/lib/domain/player-stats";
import { MATCH_STATUS_LABELS } from "@/lib/phase2/labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoForm } from "@/components/phase2/auto-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { saveResult } from "../../../actions";

export const metadata = { title: "Après-match" };

export default async function ReportPage({ params }: PageProps<"/competition/rencontres/[id]/rapport">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const [{ data: official }, { data: events }, players] = await Promise.all([
    supabase.from("lineups").select("id, lineup_players(player_id, slot)").eq("match_id", id).neq("status", "provisoire").maybeSingle(),
    supabase.from("match_events").select("match_id, type, minute, player_id, related_player_id").eq("match_id", id),
    listPlayerOptions(ctx),
  ]);
  const stats = official
    ? computePlayerStats([{ match_id: id, duration: m.duration_min, starters: (official.lineup_players ?? []).filter((p) => p.slot === "titulaire").map((p) => p.player_id), substitutes: (official.lineup_players ?? []).filter((p) => p.slot === "remplacante").map((p) => p.player_id) }], events ?? [])
    : computePlayerStats([], events ?? []);
  const rows = players.map((p) => ({ p, s: stats.get(p.id) })).filter((r) => r.s);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      {can(ctx, "matches.write") ? (
        <AutoForm action={saveResult.bind(null, id)} submitLabel="Enregistrer" columns={3}
          fields={[
            { name: "status", label: "Statut", type: "select", required: true, options: Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => ({ value, label })), defaultValue: m.status },
            { name: "goals_for", label: "Buts YFC", type: "number", min: 0, max: 50, defaultValue: m.goals_for },
            { name: "goals_against", label: "Buts adverses", type: "number", min: 0, max: 50, defaultValue: m.goals_against },
            { name: "post_report", label: "Rapport d'après-match", type: "textarea", span: 3, defaultValue: m.post_report, maxLength: 6000, rows: 8 },
            { name: "development_axes", label: "Axes de travail", type: "textarea", span: 3, defaultValue: m.development_axes, maxLength: 3000, rows: 4 },
          ]} />
      ) : (
        <Card><CardContent className="flex flex-col gap-3 pt-5">
          <div><p className="text-xs uppercase text-muted-foreground">Rapport</p><p className="whitespace-pre-line text-sm">{m.post_report ?? "—"}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Axes de travail</p><p className="whitespace-pre-line text-sm">{m.development_axes ?? "—"}</p></div>
        </CardContent></Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statistiques du match</CardTitle>
          <CardDescription>{official ? "Calculées à partir de la composition officielle et des événements saisis." : "Aucune composition officielle : seuls les buts, passes et cartons sont comptés."}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée.</p> : (
            <Table>
              <THead><TR><TH>Joueuse</TH><TH className="text-center">Min.</TH><TH className="text-center">Buts</TH><TH className="text-center">Passes D.</TH><TH className="text-center">Cartons</TH></TR></THead>
              <TBody>
                {rows.map(({ p, s }) => (
                  <TR key={p.id}>
                    <TD>{p.name}{s!.starts ? "" : s!.played ? <span className="text-xs text-muted-foreground"> (entrée)</span> : null}</TD>
                    <TD className="text-center tabular-nums">{s!.played ? s!.minutes : "—"}</TD>
                    <TD className="text-center tabular-nums">{s!.goals || ""}</TD>
                    <TD className="text-center tabular-nums">{s!.assists || ""}</TD>
                    <TD className="text-center">{"🟨".repeat(s!.yellow)}{"🟥".repeat(s!.red)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
