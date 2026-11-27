import Link from "next/link";
import { Repeat } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listPlans, listRecentReviews } from "@/lib/development/data";
import { addDays, concerned, dayFr, todayISO } from "@/lib/development/util";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DECISION_LABELS } from "@/components/development/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Réévaluations" };

export default async function ReviewsPage() {
  const ctx = await requirePermission("development.read");
  const [plans, recent] = await Promise.all([listPlans(ctx, { status: "actif" }), listRecentReviews(ctx)]);
  const today = todayISO();
  const soon = addDays(today, 7);
  const due = [...plans].sort((a, b) => (a.next_review_on ?? "0000").localeCompare(b.next_review_on ?? "0000"));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Développement" title="Réévaluations" description="À faire : plans en cours par date de réévaluation (en retard d'abord). Réalisées : les 30 dernières." />
      <section aria-label="À faire">
        <h2 className="mb-2 font-display text-lg font-bold uppercase">À faire</h2>
        {!due.length ? <EmptyState icon={Repeat} title="Aucun plan en cours" description="Les réévaluations se planifient sur chaque plan." /> : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <THead><TR><TH>Date prévue</TH><TH>Plan</TH><TH>Concerne</TH><TH>Responsable</TH></TR></THead>
              <TBody>
                {due.map((p) => {
                  const late = p.next_review_on && p.next_review_on < today;
                  const near = p.next_review_on && !late && p.next_review_on <= soon;
                  return (
                    <TR key={p.id}>
                      <TD className={cn("whitespace-nowrap", late && "font-semibold text-danger", near && "font-semibold text-warning")}>
                        {p.next_review_on ? `${dayFr(p.next_review_on)}${late ? " (en retard)" : near ? " (sous 7 jours)" : ""}` : "À planifier"}
                      </TD>
                      <TD><Link href={`/developpement/${p.id}`} className="font-semibold hover:underline">{p.title}</Link></TD>
                      <TD>{concerned(p)}</TD>
                      <TD>{p.owner ?? "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </section>
      <section aria-label="Réalisées">
        <h2 className="mb-2 font-display text-lg font-bold uppercase">Réalisées</h2>
        {!recent.length ? <p className="text-sm text-muted-foreground">Aucune réévaluation enregistrée.</p> : (
          <ul className="space-y-1 text-sm">
            {recent.map((r) => (
              <li key={r.id}><span className="tabular-nums">{dayFr(r.reviewed_on)}</span> · <Link href={`/developpement/${r.plan.id}`} className="font-medium hover:underline">{r.plan.title}</Link> <span className="text-muted-foreground">({concerned(r.plan)}) — {DECISION_LABELS[r.decision]}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
