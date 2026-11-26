import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches } from "@/lib/phase2/data";
import { mondayOf } from "@/lib/domain/match-day";
import { dayOf, dayShort, todayIso, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Documents officiels" };

export default async function OfficialDocsPage() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const matches = (await listMatches(ctx, { seasonId: scope.seasonId ?? "00000000-0000-0000-0000-000000000000", ascending: false })).slice(0, 30);
  const ids = matches.map((m) => m.id);
  const supabase = await createClient();
  const [{ data: squads }, { data: dels }] = await Promise.all([
    ids.length ? supabase.from("match_squads").select("match_id, status").in("match_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("delegations").select("match_id, status").in("match_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const sq = new Map((squads ?? []).map((s) => [s.match_id, s.status]));
  const dl = new Map((dels ?? []).map((s) => [s.match_id, s.status]));
  return (
    <>
      <PageHeader eyebrow="Rapports" title="Documents officiels" description="Convocations, onze de départ et délégations au format imprimable (PDF) ou image (PNG), avec le logo officiel."
        actions={can(ctx, "planning.read") ? <Button asChild variant="outline"><Link href={`/impression/programme?semaine=${mondayOf(todayIso())}`} target="_blank"><Printer />Programme de la semaine</Link></Button> : null} />
      {matches.length === 0 ? <Card className="p-4"><EmptyState icon={FileText} title="Aucune rencontre" /></Card> : (
        <Card>
          <Table>
            <THead><TR><TH>Date</TH><TH>Rencontre</TH><TH>Convocation</TH><TH>Onze</TH><TH>Délégation</TH></TR></THead>
            <TBody>
              {matches.map((m) => (
                <TR key={m.id}>
                  <TD className="capitalize">{dayShort(dayOf(m.kickoff_at))}</TD>
                  <TD className="font-semibold">{m.opponent}</TD>
                  <TD>{sq.has(m.id) ? <Link href={`/impression/convocation/${m.id}`} target="_blank" className="inline-flex items-center gap-1 hover:underline"><Printer className="size-3" /><Badge variant={workflowVariant(sq.get(m.id)!)}>{WORKFLOW_LABELS[sq.get(m.id)!]}</Badge></Link> : "—"}</TD>
                  <TD><Link href={`/impression/onze/${m.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs hover:underline"><Printer className="size-3" />Ouvrir</Link></TD>
                  <TD>{dl.has(m.id) ? <Link href={`/impression/delegation/${m.id}`} target="_blank" className="inline-flex items-center gap-1 hover:underline"><Printer className="size-3" /><Badge variant={workflowVariant(dl.get(m.id)!)}>{WORKFLOW_LABELS[dl.get(m.id)!]}</Badge></Link> : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
