import Link from "next/link";
import { Plus, Timer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PerfNav } from "@/components/performance/perf-nav";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Tests techniques" };

export default async function TestsPage() {
  const ctx = await requirePermission("evaluations.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("technical_test_sessions")
    .select("id, title, tested_on, location, status, protocol_ids, player_ids, technical_test_results(count)")
    .eq("club_id", ctx.clubId)
    .order("tested_on", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Performance" title="Tests techniques"
        description="Douze protocoles standardisés. Les séances validées alimentent la note technique (source Tests, 20 %) et la comparaison dans le temps."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/performance/tests/protocoles">Protocoles</Link></Button>
            {can(ctx, "evaluations.write") ? <Button asChild><Link href="/performance/tests/nouvelle"><Plus />Nouvelle séance de tests</Link></Button> : null}
          </div>
        } />
      <PerfNav />
      {rows.length === 0 ? (
        <EmptyState icon={Timer} title="Aucune séance de tests" description="Créez une séance de tests, choisissez les protocoles et les joueuses, puis saisissez les résultats." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Date</TH><TH>Séance</TH><TH>Lieu</TH><TH className="text-center">Protocoles</TH><TH className="text-center">Joueuses</TH><TH className="text-center">Résultats</TH><TH>Statut</TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDate(r.tested_on)}</TD>
                  <TD><Link href={`/performance/tests/${r.id}`} className="font-semibold hover:underline">{r.title}</Link></TD>
                  <TD className="text-muted-foreground">{r.location ?? "—"}</TD>
                  <TD className="text-center tabular-nums">{r.protocol_ids.length}</TD>
                  <TD className="text-center tabular-nums">{r.player_ids.length}</TD>
                  <TD className="text-center tabular-nums">{(r.technical_test_results as unknown as { count: number }[])[0]?.count ?? 0}</TD>
                  <TD><Badge variant={workflowVariant(r.status)}>{WORKFLOW_LABELS[r.status]}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
