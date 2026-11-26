import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { getScope, listMatches } from "@/lib/phase2/data";
import { dayOf, dayShort, HOME_AWAY_LABELS, MATCH_STATUS_LABELS, timeOf, todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Calendrier des rencontres" };

export default async function MatchesPage() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const matches = await listMatches(ctx, { seasonId: scope.seasonId ?? "00000000-0000-0000-0000-000000000000" });
  const today = todayIso();
  const next = matches.find((m) => dayOf(m.kickoff_at) >= today && m.status === "programme");
  return (
    <>
      <PageHeader eyebrow="Compétition" title="Calendrier des rencontres" description={`Saison ${scope.club.season?.label ?? "non définie"} · ${matches.length} rencontre(s). Ouvrez une rencontre pour accéder à son Match Center.`}
        actions={can(ctx, "matches.write") ? <Button asChild><Link href="/competition/rencontres/nouvelle"><Plus />Créer un match</Link></Button> : null} />
      {matches.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Trophy} title="Aucune rencontre" description="Saisissez le calendrier officiel de la compétition." /></Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Date</TH><TH>Journée</TH><TH>Rencontre</TH><TH>Compétition</TH><TH>Score</TH><TH>Statut</TH></TR></THead>
            <TBody>
              {matches.map((m) => (
                <TR key={m.id} className={m.id === next?.id ? "bg-fuchsia/5" : undefined}>
                  <TD className="whitespace-nowrap capitalize">{dayShort(dayOf(m.kickoff_at))} · {timeOf(m.kickoff_at)}</TD>
                  <TD>{m.matchday ?? "—"}</TD>
                  <TD><Link href={`/competition/rencontres/${m.id}`} className="font-semibold hover:underline">{m.opponent}</Link><span className="block text-xs text-muted-foreground">{HOME_AWAY_LABELS[m.home_away]}{m.venue ? ` · ${m.venue}` : ""}</span></TD>
                  <TD>{m.competition ?? "—"}</TD>
                  <TD className="font-display text-lg font-bold tabular-nums">{m.status === "joue" ? `${m.goals_for} – ${m.goals_against}` : "—"}</TD>
                  <TD>{m.id === next?.id ? <Badge>Prochain match</Badge> : <Badge variant={m.status === "joue" ? "success" : m.status === "programme" ? "outline" : "warning"}>{MATCH_STATUS_LABELS[m.status]}</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
