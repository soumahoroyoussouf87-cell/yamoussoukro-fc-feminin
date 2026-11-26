import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { addDays, mondayOf } from "@/lib/domain/match-day";
import { dayShort, todayIso, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Microcycles" };

export default async function MicrocyclesPage() {
  const ctx = await requirePermission("planning.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data } = scope.seasonId
    ? await supabase.from("microcycles").select("id, week_start, label, objective, status, mesocycles(name)").eq("season_id", scope.seasonId).order("week_start", { ascending: false })
    : { data: [] };
  const thisWeek = mondayOf(todayIso());
  return (
    <>
      <PageHeader eyebrow="Planification" title="Microcycles" description="Un microcycle = une semaine de travail. Chaque semaine porte son programme hebdomadaire et son circuit de validation."
        actions={<Button asChild><Link href={`/planification/programme?semaine=${thisWeek}`}><CalendarDays />Semaine en cours</Link></Button>} />
      {(data ?? []).length === 0 ? (
        <Card className="p-4"><EmptyState icon={CalendarDays} title="Aucun microcycle" description="Ouvrez le programme hebdomadaire d'une semaine pour créer son microcycle." /></Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Semaine</TH><TH>Libellé</TH><TH>Mésocycle</TH><TH>Objectif</TH><TH>Statut</TH></TR></THead>
            <TBody>
              {(data ?? []).map((m) => (
                <TR key={m.id}>
                  <TD><Link className="font-semibold hover:underline" href={`/planification/programme?semaine=${m.week_start}`}>{dayShort(m.week_start)} → {dayShort(addDays(m.week_start, 6))}</Link>{m.week_start === thisWeek ? <Badge className="ml-2">Cette semaine</Badge> : null}</TD>
                  <TD>{m.label ?? "—"}</TD>
                  <TD>{m.mesocycles?.name ?? "—"}</TD>
                  <TD className="max-w-xs truncate">{m.objective ?? "—"}</TD>
                  <TD><Badge variant={workflowVariant(m.status)}>{WORKFLOW_LABELS[m.status]}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
