import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, listPlayerOptions } from "@/lib/phase2/data";
import { defaultKey, loadEvaluationSession, profileNames } from "@/lib/performance/data";
import {
  applicableCriteria, CONTEXT_LABELS, evaluationDimensions, FRAMEWORK_KEY_LABELS, levelOf, weightedIndex,
  type Context, type FrameworkKey,
} from "@/lib/performance/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { EvalWorkflow, AddPlayers, SessionMeta } from "@/components/performance/session-tools";
import { deleteEvaluationSession, removeIndividual } from "@/lib/performance/actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Évaluation" };

export default async function EvaluationSessionPage({ params, searchParams }: PageProps<"/performance/evaluations/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadEvaluationSession(ctx, id);
  if (!data) notFound();
  const { session: s, version, evaluations } = data;
  const supabase = await createClient();
  const [players, history, names] = await Promise.all([
    listPlayerOptions(ctx),
    getApprovalHistory("evaluation_sessions", s.id),
    profileNames(evaluations.map((e) => e.evaluator_id)),
  ]);

  // Joueuses proposées : convoquées du match, présentes à la séance, sinon tout l'effectif.
  let suggested: Set<string> | null = null;
  let source = "Effectif complet";
  if (s.match_id) {
    const { data: sq } = await supabase.from("match_squads").select("match_squad_players(player_id, status)").eq("match_id", s.match_id).maybeSingle();
    const ids = (sq?.match_squad_players ?? []).filter((p) => p.status === "convoquee").map((p) => p.player_id);
    if (ids.length) { suggested = new Set(ids); source = "Joueuses convoquées pour ce match"; }
  } else if (s.training_session_id) {
    const { data: att } = await supabase.from("training_attendance").select("player_id, status").eq("session_id", s.training_session_id);
    const ids = (att ?? []).filter((a) => a.status === "present" || a.status === "retard").map((a) => a.player_id);
    if (ids.length) { suggested = new Set(ids); source = "Joueuses présentes à la séance"; }
  }

  const locked = ["valide", "publie", "archive"].includes(s.status);
  const canWrite = can(ctx, "evaluations.write") && (!locked || can(ctx, "evaluations.validate"));
  const byPlayer = new Map(players.map((p) => [p.id, p]));
  const evaluated = new Set(evaluations.map((e) => e.player_id));
  const candidates = players
    .filter((p) => !evaluated.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, shirt: p.shirt, positionLabel: p.positionLabel, key: defaultKey(p.position), suggested: suggested ? suggested.has(p.id) : true }));

  const rows = evaluations
    .map((e) => {
      const p = byPlayer.get(e.player_id);
      const fk = e.framework_key as FrameworkKey;
      const scores = e.evaluation_scores.map((x) => ({ criterionId: x.criterion_id, score: x.score }));
      const dims = evaluationDimensions(version, fk, scores);
      const flat = Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, v.index]));
      const applicable = applicableCriteria(version, fk).length;
      const noted = Object.values(dims).reduce((a, d) => a + d.evaluated, 0);
      return { e, p, fk, noted, applicable, ipi: weightedIndex(flat, version.dimensionWeights[fk]) };
    })
    .sort((a, b) => (a.p?.sort ?? 999) - (b.p?.sort ?? 999));

  const linked = s.matches as unknown as { id: string; kickoff_at: string; opponents: { name: string } | null } | null;
  const linkedSession = s.training_sessions as unknown as { id: string; number: number; theme: string | null } | null;

  return (
    <div>
      <PageHeader eyebrow={`${CONTEXT_LABELS[s.context as Context]} · ${formatDate(s.evaluated_on)}`} title={s.title}
        description={`Référentiel v${version.versionNo} · ${version.label}. Les notes sont enregistrées automatiquement.`}
        actions={<Button asChild variant="outline"><Link href="/performance/evaluations">Toutes les évaluations</Link></Button>} />
      <PerfNav />
      {sp.nouvelle ? <div className="mb-4"><Notice>Évaluation créée en brouillon. Ajoutez les joueuses ci-dessous puis notez-les.</Notice></div> : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <EvalWorkflow id={s.id} status={s.status} canWrite={can(ctx, "evaluations.write")} canValidate={can(ctx, "evaluations.validate")} />
          <ApprovalHistory items={history} />
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm">
          {linked ? <p>Match : <Link className="font-semibold hover:underline" href={`/competition/rencontres/${linked.id}`}>{linked.opponents?.name ?? "Adversaire"} · {formatDate(linked.kickoff_at)}</Link></p> : null}
          {linkedSession ? <p>Séance : <Link className="font-semibold hover:underline" href={`/entrainement/seances/${linkedSession.id}`}>n°{linkedSession.number}{linkedSession.theme ? ` · ${linkedSession.theme}` : ""}</Link></p> : null}
          <SessionMeta id={s.id} title={s.title} date={s.evaluated_on} notes={s.notes} editable={canWrite} />
        </div>
      </div>

      <h2 className="mb-2 font-display text-xl font-bold uppercase">Joueuses évaluées ({rows.length})</h2>
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune joueuse ajoutée" description={canWrite ? "Ajoutez les joueuses à évaluer avec le panneau ci-dessous." : "Aucune note saisie."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Joueuse</TH><TH>Poste occupé</TH><TH className="text-center">Minutes</TH><TH className="text-center">Critères notés</TH><TH className="text-center">Indice de l&apos;évaluation</TH><TH>Évaluateur</TH><TH /></TR></THead>
            <TBody>
              {rows.map(({ e, p, fk, noted, applicable, ipi }) => (
                <TR key={e.id}>
                  <TD>
                    <span className="flex items-center gap-2">
                      {p ? <PlayerAvatar first={p.first_name} last={p.last_name} size={28} /> : null}
                      <Link className="font-semibold hover:underline" href={`/performance/evaluations/${s.id}/joueuses/${e.player_id}`}>{p?.shirt ? `${p.shirt}. ` : ""}{p?.name ?? "Joueuse archivée"}</Link>
                    </span>
                  </TD>
                  <TD>{FRAMEWORK_KEY_LABELS[fk]}</TD>
                  <TD className="text-center tabular-nums">{e.minutes_played ?? "—"}</TD>
                  <TD className="text-center tabular-nums">{noted}/{applicable}</TD>
                  <TD className="text-center tabular-nums">{ipi == null ? <span className="text-muted-foreground">Non évalué</span> : <span title={levelOf(ipi)}>{String(ipi).replace(".", ",")}</span>}</TD>
                  <TD className="text-xs text-muted-foreground">{e.evaluator_id ? names.get(e.evaluator_id) ?? "—" : "—"}</TD>
                  <TD className="text-right">
                    <span className="inline-flex gap-1">
                      <Button asChild size="sm" variant={noted ? "outline" : "default"}><Link href={`/performance/evaluations/${s.id}/joueuses/${e.player_id}`}>{canWrite ? (noted ? "Modifier" : "Évaluer") : "Voir"}</Link></Button>
                      {canWrite ? <ActionButton variant="ghost" action={removeIndividual.bind(null, e.id)} confirm="Retirer">Retirer</ActionButton> : null}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">L&apos;indice de l&apos;évaluation combine les dimensions notées avec les pondérations du poste occupé. Il n&apos;entre dans le profil de la joueuse qu&apos;une fois l&apos;évaluation validée.</p>

      {canWrite && candidates.length ? <AddPlayers sessionId={s.id} candidates={candidates} source={source} /> : null}

      {can(ctx, "evaluations.write") && (!locked || can(ctx, "evaluations.validate")) ? (
        <div className="mt-8 border-t pt-4">
          <ActionButton action={deleteEvaluationSession.bind(null, s.id)} confirm="Supprimer définitivement">Supprimer cette évaluation</ActionButton>
        </div>
      ) : null}
    </div>
  );
}
