import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { listPlans } from "@/lib/development/data";
import { addDays, concerned, dayFr, todayISO } from "@/lib/development/util";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PLAN_STATUSES, PLAN_STATUS_LABELS, SCOPES, SCOPE_PLURAL, type PlanStatus, type Scope } from "@/components/development/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Plans de développement" };

export default async function PlansPage({ searchParams }: PageProps<"/developpement">) {
  const ctx = await requirePermission("development.read");
  const sp = await searchParams;
  const scope = SCOPES.find((s) => s === sp.portee) as Scope | undefined;
  const status = (sp.statut === "tous" ? "tous" : PLAN_STATUSES.find((s) => s === sp.statut) ?? "actif") as PlanStatus | "tous";
  const plans = await listPlans(ctx, { scope, status });
  const today = todayISO();
  const soon = addDays(today, 7);
  const active = plans.filter((p) => p.status === "actif");
  const overdue = active.filter((p) => p.next_review_on && p.next_review_on < today).length;
  const dueSoon = active.filter((p) => p.next_review_on && p.next_review_on >= today && p.next_review_on <= soon).length;
  const href = (o: { portee?: string | null; statut?: string | null }) => {
    const q = new URLSearchParams();
    const pp = o.portee === undefined ? scope : o.portee;
    const st = o.statut === undefined ? (status === "actif" ? null : status) : o.statut;
    if (pp) q.set("portee", pp);
    if (st) q.set("statut", st);
    return `/developpement${q.size ? `?${q}` : ""}`;
  };
  const tab = (active: boolean) => cn("rounded-full border px-3 py-1 text-sm font-medium", active ? "border-primary bg-primary/15 text-primary-text" : "hover:bg-muted");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Développement" title={scope ? SCOPE_PLURAL[scope] : "Plans de développement"}
        description="Objectifs mesurables, exercices correctifs et réévaluations datées. Le point de départ s'appuie sur les évaluations validées ; faits et interprétation restent séparés."
        actions={can(ctx, "development.write") ? <Button asChild><Link href={`/developpement/nouveau${scope ? `?portee=${scope}` : ""}`}><Plus />Nouveau plan</Link></Button> : null} />
      <nav aria-label="Portée" className="flex flex-wrap gap-2">
        <Link href={href({ portee: null })} className={tab(!scope)}>Tous</Link>
        {SCOPES.map((s) => <Link key={s} href={href({ portee: s })} className={tab(scope === s)}>{SCOPE_PLURAL[s]}</Link>)}
        <span className="mx-1 hidden w-px bg-border sm:block" />
        {(["actif", "termine", "abandonne", "tous"] as const).map((s) => (
          <Link key={s} href={href({ statut: s === "actif" ? null : s })} className={tab(status === s)}>{s === "tous" ? "Tous statuts" : PLAN_STATUS_LABELS[s]}</Link>
        ))}
      </nav>
      {status === "actif" || status === "tous" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Plans en cours</p><p className="font-display text-3xl font-bold">{active.length}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Réévaluations en retard</p><p className={cn("font-display text-3xl font-bold", overdue && "text-danger")}>{overdue}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Réévaluations sous 7 jours</p><p className={cn("font-display text-3xl font-bold", dueSoon && "text-warning")}>{dueSoon}</p></div>
        </div>
      ) : null}
      {!plans.length ? (
        <EmptyState icon={Target} title="Aucun plan" description={can(ctx, "development.write") ? "Crée un premier plan avec « Nouveau plan »." : "Aucun plan dans cette sélection."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Plan</TH><TH>Concerne</TH><TH>Période</TH><TH className="text-center">Objectifs atteints</TH><TH>Prochaine réévaluation</TH><TH>Responsable</TH></TR></THead>
            <TBody>
              {plans.map((p) => {
                const done = p.objectives.filter((o) => o.status === "atteint").length;
                const late = p.status === "actif" && p.next_review_on && p.next_review_on < today;
                return (
                  <TR key={p.id}>
                    <TD><Link href={`/developpement/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>{p.status !== "actif" ? <Badge variant="outline" className="ml-2">{PLAN_STATUS_LABELS[p.status]}</Badge> : null}</TD>
                    <TD>{concerned(p)}</TD>
                    <TD className="whitespace-nowrap">{dayFr(p.starts_on)} → {dayFr(p.ends_on)}</TD>
                    <TD className="text-center tabular-nums">{done}/{p.objectives.length}</TD>
                    <TD className="whitespace-nowrap">{p.status !== "actif" ? "—" : p.next_review_on ? <span className={cn(late && "font-semibold text-danger")}>{dayFr(p.next_review_on)}{late ? " (en retard)" : ""}</span> : <span className="text-muted-foreground">À planifier</span>}</TD>
                    <TD>{p.owner ?? <span className="text-muted-foreground">—</span>}</TD>
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
