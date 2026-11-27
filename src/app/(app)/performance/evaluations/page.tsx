import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CONTEXT_LABELS, type Context } from "@/lib/performance/engine";
import { WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PerfNav } from "@/components/performance/perf-nav";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Évaluations" };

export default async function EvaluationsPage() {
  const ctx = await requirePermission("evaluations.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("evaluation_sessions")
    .select("id, title, context, evaluated_on, status, framework_versions(version_no), individual_evaluations(count)")
    .eq("club_id", ctx.clubId)
    .order("evaluated_on", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  return (
    <div>
      <PageHeader eyebrow="Performance" title="Évaluations"
        description="Une évaluation regroupe les notes d'un match ou d'une séance. Seules les évaluations validées entrent dans les indices."
        actions={can(ctx, "evaluations.write") ? <Button asChild><Link href="/performance/evaluations/nouvelle"><Plus />Nouvelle évaluation</Link></Button> : null} />
      <PerfNav />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune évaluation" description="Créez une évaluation après un match ou une séance pour noter les joueuses." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Date</TH><TH>Évaluation</TH><TH>Contexte</TH><TH className="text-center">Joueuses</TH><TH>Référentiel</TH><TH>Statut</TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDate(r.evaluated_on)}</TD>
                  <TD><Link href={`/performance/evaluations/${r.id}`} className="font-semibold hover:underline">{r.title}</Link></TD>
                  <TD>{CONTEXT_LABELS[r.context as Context]}</TD>
                  <TD className="text-center tabular-nums">{(r.individual_evaluations as unknown as { count: number }[])[0]?.count ?? 0}</TD>
                  <TD>v{(r.framework_versions as { version_no: number } | null)?.version_no}</TD>
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
