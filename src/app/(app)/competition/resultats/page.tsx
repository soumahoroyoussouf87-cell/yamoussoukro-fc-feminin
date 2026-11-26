import Link from "next/link";
import { Flag } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getScope, listMatches } from "@/lib/phase2/data";
import { computeMatchRecord } from "@/lib/domain/match-record";
import { dayOf, dayShort, HOME_AWAY_LABELS } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Résultats" };

export default async function ResultsPage() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const matches = (await listMatches(ctx, { seasonId: scope.seasonId ?? "00000000-0000-0000-0000-000000000000", ascending: false })).filter((m) => m.status === "joue");
  const r = computeMatchRecord(matches);
  const form = matches.slice(0, 5).map((m) => (m.goals_for! > m.goals_against! ? "V" : m.goals_for === m.goals_against ? "N" : "D"));
  const kpis: [string, string | number][] = [
    ["Joués", r.played], ["Victoires", r.wins], ["Nuls", r.draws], ["Défaites", r.losses], ["Buts pour", r.goalsFor], ["Buts contre", r.goalsAgainst],
    ["Différence", r.goalsFor - r.goalsAgainst > 0 ? `+${r.goalsFor - r.goalsAgainst}` : r.goalsFor - r.goalsAgainst], ["Clean sheets", r.cleanSheets],
  ];
  return (
    <>
      <PageHeader eyebrow="Compétition" title="Résultats" description={`Saison ${scope.club.season?.label ?? "non définie"}. Calculé uniquement à partir des matchs au statut « Joué » dont le score est saisi.`} />
      {matches.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Flag} title="Aucun résultat" description="Les résultats apparaîtront après la saisie du score dans l'après-match de chaque rencontre." /></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {kpis.map(([k, v]) => <div key={k} className="rounded-xl border bg-card p-3"><p className="text-[11px] uppercase text-muted-foreground">{k}</p><p className="font-display text-2xl font-bold tabular-nums">{v}</p></div>)}
          </div>
          <p className="mb-4 flex items-center gap-2 text-sm">Forme (5 derniers) :
            {form.map((f, i) => <span key={i} className={`flex size-7 items-center justify-center rounded-full font-bold text-white ${f === "V" ? "bg-success" : f === "N" ? "bg-muted-foreground" : "bg-danger"}`}>{f}</span>)}
          </p>
          <Card>
            <Table>
              <THead><TR><TH>Date</TH><TH>Adversaire</TH><TH>Lieu</TH><TH>Score</TH><TH>Résultat</TH></TR></THead>
              <TBody>
                {matches.map((m) => {
                  const res = m.goals_for! > m.goals_against! ? "Victoire" : m.goals_for === m.goals_against ? "Nul" : "Défaite";
                  return (
                    <TR key={m.id}>
                      <TD className="capitalize">{dayShort(dayOf(m.kickoff_at))}</TD>
                      <TD><Link href={`/competition/rencontres/${m.id}/rapport`} className="font-semibold hover:underline">{m.opponent}</Link>{m.matchday ? <span className="ml-2 text-xs text-muted-foreground">{m.matchday}</span> : null}</TD>
                      <TD>{HOME_AWAY_LABELS[m.home_away]}</TD>
                      <TD className="font-display text-lg font-bold tabular-nums">{m.goals_for} – {m.goals_against}</TD>
                      <TD><Badge variant={res === "Victoire" ? "success" : res === "Nul" ? "outline" : "danger"}>{res}</Badge></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
