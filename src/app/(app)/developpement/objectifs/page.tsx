import Link from "next/link";
import { Goal } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listObjectives } from "@/lib/development/data";
import { concerned, dayFr, todayISO } from "@/lib/development/util";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { OBJ_DIMENSION_LABELS, OBJ_STATUS_LABELS, OBJ_STATUS_VARIANT, PRIORITY_LABELS } from "@/components/development/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Objectifs de développement" };
const fr = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

export default async function ObjectivesPage() {
  const ctx = await requirePermission("development.read");
  const rows = await listObjectives(ctx, { activeOnly: true });
  const today = todayISO();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Développement" title="Objectifs" description="Tous les objectifs des plans en cours, par échéance. Le résultat suit la dernière réévaluation." />
      {!rows.length ? <EmptyState icon={Goal} title="Aucun objectif en cours" description="Les objectifs se créent dans un plan de développement." /> : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Objectif</TH><TH>Concerne</TH><TH>Dimension</TH><TH>Départ → cible</TH><TH>Échéance</TH><TH>Priorité</TH><TH>Résultat</TH></TR></THead>
            <TBody>
              {rows.map((o) => {
                const late = o.due_on && o.due_on < today && o.status === "en_cours";
                return (
                  <TR key={o.id}>
                    <TD><Link href={`/developpement/${o.plan.id}#objectif-${o.id}`} className="font-semibold hover:underline">{o.label}</Link><p className="text-xs text-muted-foreground">{o.plan.title}{o.actions ? ` · ${o.actions} exercice${o.actions > 1 ? "s" : ""}` : ""}</p></TD>
                    <TD>{concerned(o.plan)}</TD>
                    <TD>{o.dimension ? OBJ_DIMENSION_LABELS[o.dimension] : "—"}</TD>
                    <TD className="whitespace-nowrap tabular-nums">{fr(o.baseline)} → {fr(o.target)}{o.unit ?? ""}</TD>
                    <TD className={cn("whitespace-nowrap", late && "font-semibold text-danger")}>{dayFr(o.due_on)}{late ? " (dépassée)" : ""}</TD>
                    <TD>{PRIORITY_LABELS[o.priority as keyof typeof PRIORITY_LABELS]}</TD>
                    <TD><Badge variant={OBJ_STATUS_VARIANT[o.status]}>{OBJ_STATUS_LABELS[o.status]}</Badge></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
