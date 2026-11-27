import Link from "next/link";
import { Gauge, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { periods as listPeriods, squadIndices } from "@/lib/performance/data";
import { DIMENSIONS, FRAMEWORK_KEY_LABELS, levelOf, teamDimensionIndices } from "@/lib/performance/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PerfNav } from "@/components/performance/perf-nav";
import { PeriodPicker, pickPeriod } from "@/components/performance/period-picker";
import { fmtIndex, ReliabilityBadge } from "@/components/performance/badges";

export const metadata = { title: "Performance individuelle" };

export default async function IndividualPerformancePage({ searchParams }: PageProps<"/performance/individuelle">) {
  const ctx = await requirePermission("evaluations.read");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const all = await listPeriods(ctx, today);
  const period = pickPeriod(all, sp.periode);
  const { rows, reference, min } = await squadIndices(ctx, period);
  const team = teamDimensionIndices(rows.map((r) => r.indices), min);
  const evaluatedCount = rows.filter((r) => r.indices.observations > 0).length;

  return (
    <div>
      <PageHeader eyebrow="Performance" title="Performance individuelle"
        description={`Indices calculés sur les évaluations validées. IPI publié à partir de ${min} évaluations ; les critères N/E ne pénalisent jamais.`}
        actions={can(ctx, "evaluations.write") ? <Button asChild><Link href="/performance/evaluations/nouvelle"><Plus />Évaluer</Link></Button> : null} />
      <PerfNav />
      <PeriodPicker periods={all} current={period.key} base="/performance/individuelle" />

      {!reference ? (
        <EmptyState icon={Gauge} title="Aucun référentiel publié" description="Publiez un référentiel d'évaluation pour calculer les indices." />
      ) : (
        <>
          <section aria-labelledby="team-dims" className="mb-6">
            <h2 id="team-dims" className="mb-2 font-display text-xl font-bold uppercase">Moyennes de l&apos;effectif</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">IPI moyen</p>
                <p className="font-display text-2xl font-bold tabular-nums">{team.ipi == null ? <span className="text-base text-muted-foreground">Données insuffisantes</span> : fmtIndex(team.ipi)}</p>
                <p className="text-[11px] text-muted-foreground">{team.players} joueuse(s) au-dessus du seuil</p>
              </div>
              {DIMENSIONS.map((d) => (
                <div key={d.code} className="rounded-xl border bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</p>
                  <p className="font-display text-2xl font-bold tabular-nums">{team.dims[d.code].index == null ? <span className="text-base text-muted-foreground">Non évalué</span> : fmtIndex(team.dims[d.code].index)}</p>
                  <p className="text-[11px] text-muted-foreground">{team.dims[d.code].index == null ? "—" : `${levelOf(team.dims[d.code].index)} · ${team.dims[d.code].players} joueuse(s)`}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Moyenne des joueuses ayant au moins {min} évaluations validées sur la période. Ce n&apos;est pas l&apos;indice collectif (IPC), qui mesure directement la maîtrise du projet de jeu (voir Performance collective).</p>
          </section>

          {evaluatedCount === 0 ? (
            <EmptyState icon={Gauge} title="Aucune évaluation validée sur la période" description="Les indices apparaissent dès qu'une évaluation est validée par l'entraîneur principal ou la direction sportive." />
          ) : null}

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <THead>
                <TR>
                  <TH>Joueuse</TH><TH>Poste évalué</TH><TH className="text-center">IPI</TH>
                  {DIMENSIONS.map((d) => <TH key={d.code} className="text-center">{d.label.slice(0, 4)}.</TH>)}
                  <TH className="text-center">Éval.</TH><TH>Fiabilité</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ player: p, indices: x }) => (
                  <TR key={p.id}>
                    <TD><Link href={`/performance/individuelle/${p.id}?periode=${period.key}`} className="font-semibold hover:underline">{p.shirt ? `${p.shirt}. ` : ""}{p.name}</Link></TD>
                    <TD className="text-xs">{x.frameworkKey ? FRAMEWORK_KEY_LABELS[x.frameworkKey] : <span className="text-muted-foreground">{p.positionLabel ?? "—"}</span>}</TD>
                    <TD className="text-center font-semibold tabular-nums">
                      {x.ipiStatus === "publie" ? fmtIndex(x.ipi) : <span className="text-xs font-normal text-muted-foreground">{x.ipiStatus === "insuffisant" ? `Données insuffisantes (${x.observations}/${min})` : "Non évalué"}</span>}
                    </TD>
                    {DIMENSIONS.map((d) => <TD key={d.code} className="text-center tabular-nums" title={`${d.label} : ${x.dims[d.code].n} évaluation(s)`}>{x.dims[d.code].index == null ? <span className="text-muted-foreground">—</span> : fmtIndex(x.dims[d.code].index)}</TD>)}
                    <TD className="text-center tabular-nums">{x.observations}</TD>
                    <TD>{x.observations ? <ReliabilityBadge value={x.reliability} /> : <span className="text-xs text-muted-foreground">—</span>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
