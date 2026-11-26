import Link from "next/link";
import { FileText } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { dayOf, dayShort } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Rapports de match" };

export default async function MatchReportsPage() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, kickoff_at, goals_for, goals_against, post_report, development_axes, opponents(name)")
    .eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000")
    .eq("status", "joue")
    .order("kickoff_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow="Rapports" title="Rapports de match" description="Rapports d'après-match et axes de travail rédigés par le staff." />
      {(data ?? []).length === 0 ? <Card className="p-4"><EmptyState icon={FileText} title="Aucun match joué" /></Card> : (
        <Card>
          <Table>
            <THead><TR><TH>Date</TH><TH>Rencontre</TH><TH>Score</TH><TH>Rapport</TH><TH>Axes de travail</TH></TR></THead>
            <TBody>
              {(data ?? []).map((m) => (
                <TR key={m.id}>
                  <TD className="capitalize">{dayShort(dayOf(m.kickoff_at))}</TD>
                  <TD><Link href={`/competition/rencontres/${m.id}/rapport`} className="font-semibold hover:underline">{m.opponents?.name}</Link></TD>
                  <TD className="font-display font-bold">{m.goals_for} – {m.goals_against}</TD>
                  <TD>{m.post_report ? <span className="line-clamp-2 text-xs">{m.post_report}</span> : <Badge variant="warning">À rédiger</Badge>}</TD>
                  <TD className="text-xs">{m.development_axes ? <span className="line-clamp-2">{m.development_axes}</span> : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
