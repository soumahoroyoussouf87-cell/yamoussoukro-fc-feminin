import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/development/data";
import { concerned, dayFr, todayISO } from "@/lib/development/util";
import { listStaffOptions } from "@/lib/phase2/data";
import { loadPlayerReport } from "@/lib/reports/data";
import { DIMENSIONS } from "@/lib/performance/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AddObjective, DeleteReviewButton, ObjectiveCard, PlanHeaderEditor, ReviewForm, type Measure, type Suggestion } from "@/components/development/plan-editor";
import { DECISION_LABELS, OBJ_STATUS_LABELS, OBJ_STATUS_VARIANT, PLAN_STATUS_LABELS, SCOPE_LABELS } from "@/components/development/labels";

export const metadata = { title: "Plan de développement" };
const fr = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));

export default async function PlanPage({ params }: PageProps<"/developpement/[id]">) {
  const ctx = await requirePermission("development.read");
  const { id } = await params;
  const plan = await loadPlan(ctx, id);
  if (!plan) notFound();
  const editable = can(ctx, "development.write");
  const supabase = await createClient();
  const individual = plan.scope === "individuel" && plan.player;
  const [staff, exercises, before, since] = await Promise.all([
    editable ? listStaffOptions(ctx) : Promise.resolve([]),
    editable && can(ctx, "planning.read")
      ? supabase.from("exercises").select("id, title").eq("club_id", ctx.clubId).is("archived_at", null).order("title").limit(400).then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; title: string }[]),
    individual && can(ctx, "evaluations.read") ? loadPlayerReport(ctx, plan.player!.id, { from: null, to: plan.starts_on }) : Promise.resolve(null),
    individual && can(ctx, "evaluations.read") ? loadPlayerReport(ctx, plan.player!.id, { from: plan.starts_on, to: null }) : Promise.resolve(null),
  ]);
  // Libellés et dimension des critères du référentiel publié (pour les objectifs reliés à un critère).
  const ref = before?.reference ?? since?.reference ?? null;
  const critLabel = new Map<string, string>(ref ? ref.criteria.map((c) => [c.code, c.label]) : []);
  const suggestions: Suggestion[] = (before?.workOn ?? []).map((c) => ({
    code: c.code, label: c.label, dimension: c.dimension, dimensionCode: DIMENSIONS.find((d) => d.label === c.dimension)?.code ?? "technique", mean: Math.round((c.mean ?? 0) * 10) / 10, n: c.n,
  }));
  const measures: Record<string, Measure> = {};
  for (const o of plan.objectives) {
    if (o.criterion_code && since?.x) {
      const m = since.x.criteria[o.criterion_code];
      measures[o.id] = { mean: m?.mean != null ? Math.round(m.mean * 10) / 10 : null, n: m?.n ?? 0 };
    }
  }
  const objLabel = new Map(plan.objectives.map((o, i) => [o.id, `${i + 1}. ${o.label}`]));
  const today = todayISO();
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/developpement?portee=${plan.scope}`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">← Plans de développement</Link>
      <PageHeader eyebrow={`Plan ${SCOPE_LABELS[plan.scope].toLowerCase()} · ${concerned(plan)}`} title={plan.title}
        description={`${PLAN_STATUS_LABELS[plan.status]} · du ${dayFr(plan.starts_on)} au ${dayFr(plan.ends_on)}${plan.next_review_on && plan.status === "actif" ? ` · prochaine réévaluation le ${dayFr(plan.next_review_on)}` : ""}`}
        actions={<a href={`/impression/pdi/${plan.id}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"><Printer className="size-4" />Imprimer le plan</a>} />

      {individual ? (
        <section aria-label="Point de départ" className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold uppercase">Point de départ</h2>
            <Link href={`/performance/individuelle/${plan.player!.id}`} className="text-sm font-medium text-primary hover:underline">Profil 360° de {plan.player!.name} →</Link>
          </div>
          {!before?.x || before.x.observations === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune évaluation validée avant le début du plan : renseigne le point de départ de chaque objectif à la main.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">Évaluations validées avant le {dayFr(plan.starts_on)} ({before.x.observations} observation{before.x.observations > 1 ? "s" : ""}). Dimensions non évaluées non pénalisées.</p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {DIMENSIONS.map((d) => (
                  <li key={d.code} className="rounded-lg border p-2 text-center">
                    <p className="text-[11px] uppercase text-muted-foreground">{d.label}</p>
                    <p className="font-display text-xl font-bold tabular-nums">{before.x!.dims[d.code].index == null ? "N/E" : fr(Math.round(before.x!.dims[d.code].index! * 10) / 10)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <PlanHeaderEditor plan={plan} staff={staff} editable={editable} />

      <section aria-label="Objectifs" className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold uppercase">Objectifs ({plan.objectives.length})</h2>
        {plan.objectives.map((o, i) => (
          <ObjectiveCard key={o.id} o={o} index={i} editable={editable} measure={measures[o.id]}
            criterionLabel={o.criterion_code ? critLabel.get(o.criterion_code) ?? o.criterion_code : undefined}
            exercises={exercises.map((e) => ({ value: e.id, label: e.title }))} />
        ))}
        {!plan.objectives.length && !editable ? <p className="text-sm text-muted-foreground">Aucun objectif.</p> : null}
        {editable ? <AddObjective planId={plan.id} suggestions={suggestions} usedCodes={plan.objectives.map((o) => o.criterion_code).filter(Boolean) as string[]} /> : null}
      </section>

      <section aria-label="Réévaluations" className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold uppercase">Réévaluations ({plan.reviews.length})</h2>
        {editable && plan.status === "actif" ? <ReviewForm planId={plan.id} objectives={plan.objectives} today={today} measures={measures} /> : null}
        {plan.reviews.map((r) => (
          <article key={r.id} className="rounded-xl border bg-card p-4">
            <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">Réévaluation du {dayFr(r.reviewed_on)}</h3>
                <p className="text-xs text-muted-foreground">{DECISION_LABELS[r.decision]}{r.next_review_on ? ` · prochaine le ${dayFr(r.next_review_on)}` : ""}{r.author ? ` · par ${r.author}` : ""}</p>
              </div>
              {editable ? <DeleteReviewButton id={r.id} /> : null}
            </header>
            {r.items.length ? (
              <ul className="mb-2 space-y-1 text-sm">
                {r.items.map((i) => (
                  <li key={i.objective_id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={OBJ_STATUS_VARIANT[i.status]}>{OBJ_STATUS_LABELS[i.status]}</Badge>
                    <span>{objLabel.get(i.objective_id) ?? "Objectif retiré"}{i.value != null ? ` · mesuré ${fr(i.value)}` : ""}{i.comment ? ` — ${i.comment}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-3 text-sm lg:grid-cols-2">
              <div><p className="font-semibold">Faits constatés</p><p className="whitespace-pre-line text-muted-foreground">{r.facts || "—"}</p></div>
              <div><p className="font-semibold">Interprétation du staff</p><p className="whitespace-pre-line text-muted-foreground">{r.interpretation || "—"}</p></div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
