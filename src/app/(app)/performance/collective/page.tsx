import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periods as listPeriods } from "@/lib/performance/data";
import { teamIndices } from "@/lib/performance/collective-data";
import { MOMENTS, RELATION_LABELS, RELATIONS, SECTORS, SITUATION_LABELS } from "@/lib/performance/collective";
import { fmtDelta, levelOf } from "@/lib/performance/engine";
import { WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PerfNav } from "@/components/performance/perf-nav";
import { PeriodPicker, pickPeriod } from "@/components/performance/period-picker";
import { fmtIndex, ReliabilityBadge } from "@/components/performance/badges";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Performance collective" };

function Tile({ label, value, hint, delta }: { label: string; value: number | null; hint: string; delta?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">
        {value == null ? <span className="text-base text-muted-foreground">Données insuffisantes</span> : delta ? fmtDelta(value) : fmtIndex(value)}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

const Cell = ({ v }: { v: number | null }) => (v == null ? <span className="text-muted-foreground">N/E</span> : <>{fmtIndex(v)}</>);

export default async function CollectivePage({ searchParams }: PageProps<"/performance/collective">) {
  const ctx = await requirePermission("evaluations.read");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const all = await listPeriods(ctx, today);
  const period = pickPeriod(all, sp.periode);
  const supabase = await createClient();
  const [{ reference, min, team, dev }, { data: evals }] = await Promise.all([
    teamIndices(ctx, period),
    supabase.from("collective_evaluations").select("id, title, context, evaluated_on, status, game_model_versions(version_no), collective_scores(count)")
      .eq("club_id", ctx.clubId).order("evaluated_on", { ascending: false }).limit(200),
  ]);
  const list = evals ?? [];

  return (
    <div>
      <PageHeader eyebrow="Performance" title="Performance collective"
        description={`Indices calculés uniquement sur les évaluations collectives validées, jamais sur les notes individuelles. Publiés à partir de ${min} évaluations.`}
        actions={can(ctx, "evaluations.write") ? <Button asChild><Link href="/performance/collective/nouvelle"><Plus />Évaluer le collectif</Link></Button> : null} />
      <PerfNav />
      <PeriodPicker periods={all} current={period.key} base="/performance/collective" />

      {!reference || !team || !dev ? (
        <EmptyState icon={Users} title="Aucun projet de jeu publié" description="Publiez le projet de jeu pour évaluer le collectif." />
      ) : (
        <>
          <section aria-labelledby="team-idx" className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id="team-idx" className="font-display text-xl font-bold uppercase">Indices de l&apos;équipe</h2>
              {team.observations ? <ReliabilityBadge value={team.reliability} /> : null}
              <span className="text-xs text-muted-foreground">{team.observations} évaluation(s) validée(s) · {team.evaluatedPrinciples}/{team.totalPrinciples} principes observés · projet de jeu v{reference.versionNo}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Tile label="IPC · collectif" value={team.ipc} hint={team.ipc == null ? `${team.observations}/${min} évaluations` : levelOf(team.ipc)} />
              <Tile label="IMP · maîtrise du projet" value={team.imp} hint="Part des principes maîtrisés (≥ 60)" />
              <Tile label="IPS · secteurs" value={team.ips} hint={team.ips == null ? "—" : levelOf(team.ips)} />
              <Tile label="IPR · relations" value={team.ipr} hint={team.ipr == null ? "—" : levelOf(team.ipr)} />
              <Tile label="IDC · progression collective" value={dev.idc} hint="IPC, même version et même contexte" delta />
              <Tile label="IDS · progression sectorielle" value={dev.ids} hint="IPS, même contexte" delta />
            </div>
            {!team.enough && team.observations ? <p className="mt-2 text-xs text-muted-foreground">Valeurs provisoires (non publiées) : IPC {fmtIndex(team.raw.ipc)}, IPS {fmtIndex(team.raw.ips)}, IPR {fmtIndex(team.raw.ipr)}.</p> : null}
          </section>

          <section aria-labelledby="moments" className="mb-6">
            <h2 id="moments" className="mb-2 font-display text-xl font-bold uppercase">Moments du jeu</h2>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <THead><TR><TH>Moment</TH><TH className="text-center">Poids</TH><TH className="text-center">Indice</TH><TH className="text-center">Maîtrise</TH><TH className="text-center">Éval.</TH></TR></THead>
                <TBody>
                  {MOMENTS.map((m) => {
                    const x = team.moments[m.code];
                    return (
                      <TR key={m.code}>
                        <TD className="font-semibold">{m.label}</TD>
                        <TD className="text-center tabular-nums">{x?.weight ?? 0} %</TD>
                        <TD className="text-center tabular-nums"><Cell v={x?.index ?? null} /></TD>
                        <TD className="text-center tabular-nums">{team.mastery[m.code] == null ? <span className="text-muted-foreground">—</span> : `${fmtIndex(team.mastery[m.code]!)} %`}</TD>
                        <TD className="text-center tabular-nums">{x?.n ?? 0}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </section>

          <section aria-labelledby="principes" className="mb-6">
            <h2 id="principes" className="mb-2 font-display text-xl font-bold uppercase">Principes</h2>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <THead><TR><TH>Principe</TH><TH>Moment</TH><TH className="text-center">Moyenne</TH><TH className="text-center">Éval.</TH><TH>État</TH></TR></THead>
                <TBody>
                  {team.principles.map((p) => (
                    <TR key={p.code}>
                      <TD>{p.label}</TD>
                      <TD className="text-xs text-muted-foreground">{MOMENTS.find((m) => m.code === p.moment)?.label}</TD>
                      <TD className="text-center tabular-nums"><Cell v={p.mean} /></TD>
                      <TD className="text-center tabular-nums">{p.n}</TD>
                      <TD>{p.mastered == null ? <span className="text-xs text-muted-foreground">Non observé</span> : <Badge variant={p.mastered ? "success" : "warning"}>{p.mastered ? "Maîtrisé" : "À travailler"}</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <section id="secteurs" aria-labelledby="sect-h" className="scroll-mt-20">
              <h2 id="sect-h" className="mb-2 font-display text-xl font-bold uppercase">Performance sectorielle</h2>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <THead><TR><TH>Secteur</TH><TH className="text-center">Indice</TH><TH className="text-center">Éval.</TH></TR></THead>
                  <TBody>
                    {SECTORS.map((s) => <TR key={s.code}><TD>{s.label}</TD><TD className="text-center tabular-nums"><Cell v={team.sectors[s.code].index} /></TD><TD className="text-center tabular-nums">{team.sectors[s.code].n}</TD></TR>)}
                  </TBody>
                </Table>
              </div>
            </section>
            <section id="relations" aria-labelledby="rel-h" className="scroll-mt-20">
              <h2 id="rel-h" className="mb-2 font-display text-xl font-bold uppercase">Performance intersectorielle</h2>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <THead><TR><TH>Relation</TH><TH className="text-center">Indice</TH><TH className="text-center">Éval.</TH></TR></THead>
                  <TBody>
                    {RELATIONS.map((s) => <TR key={s.code}><TD>{s.label}</TD><TD className="text-center tabular-nums"><Cell v={team.relations[s.code].index} /></TD><TD className="text-center tabular-nums">{team.relations[s.code].n}</TD></TR>)}
                  </TBody>
                </Table>
              </div>
            </section>
          </div>

          <section aria-labelledby="compact" className="mb-6">
            <h2 id="compact" className="mb-2 font-display text-xl font-bold uppercase">Compacité</h2>
            {team.measures.length === 0 ? <p className="text-sm text-muted-foreground">Aucune distance mesurée sur la période. Ajoutez-les dans l&apos;onglet « Relations et compacité » d&apos;une évaluation.</p> : (
              <>
                <p className="mb-2 text-sm">{team.compactness.inTarget}/{team.compactness.checked} mesure(s) dans la zone cible.</p>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <THead><TR><TH>Date</TH><TH>Lignes</TH><TH>Situation</TH><TH className="text-center">Distance</TH><TH className="text-center">Cible</TH><TH>Résultat</TH></TR></THead>
                    <TBody>
                      {[...team.measures].reverse().map((m, i) => (
                        <TR key={i}>
                          <TD className="whitespace-nowrap"><Link href={`/performance/collective/${m.evaluationId}`} className="hover:underline">{formatDate(m.date)}</Link></TD>
                          <TD>{RELATION_LABELS[m.relation] ?? m.relation}</TD>
                          <TD>{SITUATION_LABELS[m.situation] ?? m.situation}</TD>
                          <TD className="text-center tabular-nums">{fmtIndex(m.distance)} m</TD>
                          <TD className="text-center tabular-nums">{m.targetMin == null ? "—" : `${fmtIndex(m.targetMin)}–${fmtIndex(m.targetMax)} m`}</TD>
                          <TD>{m.ok == null ? <span className="text-xs text-muted-foreground">Sans cible</span> : <Badge variant={m.ok ? "success" : "warning"}>{m.ok ? "Dans la cible" : "Hors cible"}</Badge>}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </>
            )}
          </section>

          {dev.comparisons.length ? (
            <section aria-labelledby="dev" className="mb-6">
              <h2 id="dev" className="mb-2 font-display text-xl font-bold uppercase">Progression</h2>
              <ul className="space-y-1 text-sm">
                {dev.comparisons.map((c) => (
                  <li key={c.key}><span className="font-semibold">{c.label}</span> : {fmtIndex(c.first.value)} le {formatDate(c.first.date)} → {fmtIndex(c.last.value)} le {formatDate(c.last.date)} ({fmtDelta(c.delta)}, {c.n} évaluations)</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section aria-labelledby="evals">
        <h2 id="evals" className="mb-2 font-display text-xl font-bold uppercase">Évaluations collectives</h2>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">Aucune évaluation collective pour l&apos;instant.</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <THead><TR><TH>Date</TH><TH>Évaluation</TH><TH>Contexte</TH><TH className="text-center">Version</TH><TH className="text-center">Notes</TH><TH>Statut</TH></TR></THead>
              <TBody>
                {list.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{formatDate(r.evaluated_on)}</TD>
                    <TD><Link href={`/performance/collective/${r.id}`} className="font-semibold hover:underline">{r.title}</Link></TD>
                    <TD>{r.context === "match" ? "Compétition" : "Entraînement"}</TD>
                    <TD className="text-center tabular-nums">v{(r.game_model_versions as unknown as { version_no: number } | null)?.version_no ?? "?"}</TD>
                    <TD className="text-center tabular-nums">{(r.collective_scores as unknown as { count: number }[])[0]?.count ?? 0}</TD>
                    <TD><Badge variant={workflowVariant(r.status)}>{WORKFLOW_LABELS[r.status]}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
