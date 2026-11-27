import Link from "next/link";
import { notFound } from "next/navigation";
import { Gauge, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/data/players";
import { getMinObservations, getPublishedVersion, loadObservations, loadTestResults, periods as listPeriods, profileNames } from "@/lib/performance/data";
import {
  aggregatePlayer, applicableCriteria, CONTEXT_LABELS, developmentIndex, DIMENSIONS, fmtDelta, FRAMEWORK_KEY_LABELS, levelOf, POSITION_FRAMEWORK_KEY,
} from "@/lib/performance/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { PerfNav } from "@/components/performance/perf-nav";
import { PeriodPicker, pickPeriod } from "@/components/performance/period-picker";
import { fmtIndex, ReliabilityBadge } from "@/components/performance/badges";
import { Progression, Radar } from "@/components/performance/charts";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Profil de performance" };

export default async function PlayerPerformancePage({ params, searchParams }: PageProps<"/performance/individuelle/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: player } = await supabase.from("players")
    .select("id, first_name, last_name, photo_path, player_positions(is_primary, positions(code, label))").eq("id", id).maybeSingle();
  if (!player) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const all = await listPeriods(ctx, today);
  const period = pickPeriod(all, sp.periode);
  const [reference, min, { rows, versions }, photos, tests] = await Promise.all([
    getPublishedVersion(ctx), getMinObservations(ctx), loadObservations(ctx, { playerId: id, from: period.from, to: period.to }),
    signPhotos("player-photos", [player.photo_path]), loadTestResults(ctx, { playerId: id, from: period.from, to: period.to }),
  ]);
  const primary = (player.player_positions as { is_primary: boolean; positions: { code: string; label: string } | null }[]).find((p) => p.is_primary)?.positions;
  const names = await profileNames(rows.map((r) => r.evaluatorId));
  const mine = tests.byPlayer.get(id);
  const primaryKey = primary ? POSITION_FRAMEWORK_KEY[primary.code] ?? null : null;
  const x = reference ? aggregatePlayer(rows, versions, reference, min, { tests: mine?.sessions, fallbackKey: primaryKey }) : null;
  const dev = x ? developmentIndex({ tests: mine?.points ?? [], timeline: x.timeline, versionNo: (v) => versions.get(v)?.versionNo }) : null;
  const testRows = mine?.rows ?? [];
  const protocolsSeen = [...new Map(testRows.map((r) => [r.protocolId, r.protocolName])).entries()];
  const fk = x?.frameworkKey ?? (primary ? POSITION_FRAMEWORK_KEY[primary.code] : null) ?? null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const name = `${player.first_name} ${player.last_name}`;
  const { data: plan } = can(ctx, "development.read")
    ? await supabase.from("development_plans").select("id").eq("player_id", id).eq("status", "actif").order("ends_on").limit(1).maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader eyebrow="Profil de performance 360°" title={name}
        description={`${primary?.label ?? "Poste non renseigné"}${x?.frameworkKey ? ` · évaluée surtout comme ${FRAMEWORK_KEY_LABELS[x.frameworkKey]}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/effectif/${id}`}>Fiche joueuse</Link></Button>
            {plan ? <Button asChild variant="outline"><Link href={`/developpement/${plan.id}`}>Plan de développement</Link></Button>
              : can(ctx, "development.write") ? <Button asChild variant="outline"><Link href={`/developpement/nouveau?portee=individuel&joueuse=${id}`}>Créer un plan de développement</Link></Button> : null}
            {can(ctx, "evaluations.write") ? <Button asChild><Link href="/performance/evaluations/nouvelle"><Plus />Évaluer</Link></Button> : null}
          </div>
        } />
      <PerfNav />
      <PeriodPicker periods={all} current={period.key} base={`/performance/individuelle/${id}`} />

      {!x || !reference ? (
        <EmptyState icon={Gauge} title="Aucun référentiel publié" description="Publiez un référentiel pour calculer les indices." />
      ) : x.observations === 0 && x.testSessions === 0 ? (
        <EmptyState icon={Gauge} title="Aucune évaluation validée sur la période" description="Le profil se construit à partir des évaluations validées (match et entraînement) et des séances de tests validées." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <PlayerAvatar src={player.photo_path ? photos.get(player.photo_path) : null} first={player.first_name} last={player.last_name} size={52} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">IPI</p>
                <p className="font-display text-3xl font-bold tabular-nums">{x.ipiStatus === "publie" ? fmtIndex(x.ipi) : <span className="text-sm text-muted-foreground">Données insuffisantes</span>}</p>
                <p className="text-[11px] text-muted-foreground">{x.ipiStatus === "publie" ? levelOf(x.ipi) : `${x.observations}/${min} évaluations`}</p>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Évaluations validées</p>
              <p className="font-display text-3xl font-bold tabular-nums">{x.observations}</p>
              <p className="text-[11px] text-muted-foreground">du {formatDate(x.from)} au {formatDate(x.to)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Couverture des critères</p>
              <p className="font-display text-3xl font-bold tabular-nums">{Math.round(x.coverage * 100)} %</p>
              <p className="text-[11px] text-muted-foreground">{x.evaluatedCriteria} sur {x.applicableCriteria} critères du poste</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fiabilité</p>
              <div className="mt-2"><ReliabilityBadge value={x.reliability} /></div>
              <p className="mt-1 text-[11px] text-muted-foreground">Référentiel v{reference.versionNo}{x.testSessions ? ` · ${x.testSessions} séance(s) de tests` : ""}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">IDI · développement</p>
              <p className="font-display text-3xl font-bold tabular-nums">{dev?.idi == null ? <span className="text-sm text-muted-foreground">Pas encore comparable</span> : fmtDelta(dev.idi)}</p>
              <p className="text-[11px] text-muted-foreground">{dev?.idi == null ? "Il faut deux mesures dans les mêmes conditions" : `${dev.relative == null ? "" : `${fmtDelta(dev.relative, "%")} · `}${dev.comparisons.length} comparaison(s)`}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHeader><CardTitle className="text-base">Profil par dimension</CardTitle><CardDescription>Indices sur 100, {period.label.toLowerCase()}</CardDescription></CardHeader>
              <CardContent>
                <Radar axes={DIMENSIONS.map((d) => ({ label: d.label, value: x.dims[d.code].index, n: x.dims[d.code].n }))} />
                <dl className="mt-3 divide-y text-sm">
                  {DIMENSIONS.map((d) => (
                    <div key={d.code} className="flex items-center justify-between py-1.5">
                      <dt>{d.label} {fk ? <span className="text-xs text-muted-foreground">({reference.dimensionWeights[fk]?.[d.code] ?? 0} %)</span> : null}</dt>
                      <dd className="tabular-nums">{x.dims[d.code].index == null ? <span className="text-muted-foreground">Non évalué</span> : <>{fmtIndex(x.dims[d.code].index)} <span className="text-xs text-muted-foreground">· {x.dims[d.code].n} éval.</span></>}</dd>
                    </div>
                  ))}
                </dl>
                {x.technicalSources.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Technique : {x.technicalSources.map((s) => `${CONTEXT_LABELS[s.context]} ${fmtIndex(s.index)} (${fmtIndex(s.effectiveWeight)} %)`).join(" · ")}
                    {x.technicalRenormalized ? ". Poids renormalisés sur les sources présentes (tests 20 %, entraînement 30 %, compétition 50 %)." : "."}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Progression</CardTitle><CardDescription>Indice de chaque évaluation validée, avec les pondérations du poste occupé</CardDescription></CardHeader>
              <CardContent>
                <Progression points={x.timeline.map((t) => ({ id: t.id, date: t.date, context: t.context, value: t.ipi, title: byId.get(t.id)?.title }))} />
              </CardContent>
            </Card>
          </div>

          {fk ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Détail des critères · {FRAMEWORK_KEY_LABELS[fk]}</CardTitle><CardDescription>Moyenne sur la période et nombre d&apos;observations. « — » = jamais évalué.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {DIMENSIONS.map((d) => (
                  <div key={d.code}>
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide">{d.label}</h3>
                    <ul className="text-sm">
                      {applicableCriteria(reference, fk, d.code).map((c) => {
                        const m = x.criteria[c.code];
                        return (
                          <li key={c.id} className="flex justify-between gap-2 border-b border-dashed py-1">
                            <span>{c.label}</span>
                            <span className="whitespace-nowrap tabular-nums">{m ? <>{fmtIndex(m.mean)} <span className="text-xs text-muted-foreground">×{m.n}</span></> : <span className="text-muted-foreground">—</span>}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Tests techniques</CardTitle><CardDescription>Séances validées sur la période. L&apos;évolution compare la première et la dernière mesure faites avec la même version du protocole.</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {protocolsSeen.length === 0 ? <p className="px-6 pb-6 text-sm text-muted-foreground">Aucun test validé sur la période.</p> : (
                  <Table>
                    <THead><TR><TH>Protocole</TH><TH>Dernier résultat</TH><TH className="text-center">Indice</TH><TH className="text-center">Évolution</TH></TR></THead>
                    <TBody>
                      {protocolsSeen.map(([pid, pname]) => {
                        const list = testRows.filter((r) => r.protocolId === pid);
                        const last = list.at(-1)!;
                        const cmp = dev?.comparisons.find((c) => c.kind === "test" && c.key === `${pid}|${last.protocolVersion}`);
                        const raw = dev?.rawOnly.find((c) => c.key === `${pid}|${last.protocolVersion}`);
                        return (
                          <TR key={pid}>
                            <TD><span className="font-medium">{pname}</span><span className="block text-xs text-muted-foreground">{formatDate(last.date)} · {list.length} mesure(s)</span></TD>
                            <TD className="tabular-nums">{last.measure === "temps" ? (last.valueSeconds == null ? "—" : `${String(last.valueSeconds).replace(".", ",")} s`) : `${last.successes ?? "—"}/${last.attempts ?? "—"}`}{last.errors ? <span className="text-xs text-muted-foreground"> · {last.errors} err.</span> : null}</TD>
                            <TD className="text-center tabular-nums">{fmtIndex(last.index)}</TD>
                            <TD className="text-center tabular-nums">{cmp ? <span className={cmp.delta > 0 ? "text-success" : cmp.delta < 0 ? "text-danger" : ""}>{fmtDelta(cmp.delta)}</span> : raw?.rawDelta != null ? <span className={raw.rawDelta < 0 ? "text-success" : raw.rawDelta > 0 ? "text-danger" : ""}>{fmtDelta(raw.rawDelta, "s")}</span> : <span className="text-xs text-muted-foreground">—</span>}</TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Développement (IDI)</CardTitle><CardDescription>Progression entre la première et la dernière mesure comparable : même protocole et même version pour les tests ; même référentiel, même poste et même contexte pour les évaluations.</CardDescription></CardHeader>
              <CardContent>
                {!dev || dev.comparisons.length === 0 ? <p className="text-sm text-muted-foreground">Pas encore de mesure comparable sur la période.</p> : (
                  <ul className="divide-y text-sm">
                    {dev.comparisons.map((c) => (
                      <li key={`${c.kind}-${c.key}`} className="flex items-start justify-between gap-3 py-2">
                        <span><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{fmtIndex(c.first.value)} le {formatDate(c.first.date)} → {fmtIndex(c.last.value)} le {formatDate(c.last.date)} · {c.n} mesures</span></span>
                        <span className="whitespace-nowrap text-right tabular-nums">
                          <strong className={c.delta > 0 ? "text-success" : c.delta < 0 ? "text-danger" : ""}>{fmtDelta(c.delta)}</strong>
                          <span className="block text-xs text-muted-foreground">{c.relative == null ? "—" : fmtDelta(c.relative, "%")}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Progression absolue en points d&apos;indice ; progression relative en % de la valeur de départ.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Historique des évaluations</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <THead><TR><TH>Date</TH><TH>Évaluation</TH><TH>Contexte</TH><TH>Poste occupé</TH><TH className="text-center">Indice</TH><TH>Évaluateur</TH><TH>Référentiel</TH></TR></THead>
                <TBody>
                  {[...x.timeline].reverse().map((t) => {
                    const r = byId.get(t.id)!;
                    return (
                      <TR key={t.id}>
                        <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                        <TD><Link className="hover:underline" href={`/performance/evaluations/${r.sessionId}/joueuses/${id}`}>{r.title}</Link></TD>
                        <TD>{CONTEXT_LABELS[t.context]}</TD>
                        <TD>{FRAMEWORK_KEY_LABELS[r.frameworkKey]}</TD>
                        <TD className="text-center tabular-nums">{fmtIndex(t.ipi)}</TD>
                        <TD className="text-xs text-muted-foreground">{r.evaluatorId ? names.get(r.evaluatorId) ?? "—" : "—"}</TD>
                        <TD>v{versions.get(r.versionId)?.versionNo}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
