import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { listPlayerOptions } from "@/lib/phase2/data";
import { loadEvaluationSession } from "@/lib/performance/data";
import { CONTEXT_LABELS, type Context, type FrameworkKey } from "@/lib/performance/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PerfNav } from "@/components/performance/perf-nav";
import { ScoreSheet } from "@/components/performance/score-sheet";
import { WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Évaluer une joueuse" };

export default async function ScorePage({ params }: PageProps<"/performance/evaluations/[id]/joueuses/[player]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id, player } = await params;
  const data = await loadEvaluationSession(ctx, id);
  if (!data) notFound();
  const { session: s, version, evaluations } = data;
  const ev = evaluations.find((e) => e.player_id === player);
  if (!ev) notFound();
  const players = await listPlayerOptions(ctx);
  const byId = new Map(players.map((p) => [p.id, p]));
  const order = evaluations
    .map((e) => ({ id: e.player_id, sort: byId.get(e.player_id)?.sort ?? 999 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.id);
  const i = order.indexOf(player);
  const prev = i > 0 ? order[i - 1] : null;
  const next = i < order.length - 1 ? order[i + 1] : null;
  const p = byId.get(player);
  const locked = ["valide", "publie", "archive"].includes(s.status);
  const editable = can(ctx, "evaluations.write") && (!locked || can(ctx, "evaluations.validate"));
  const name = p ? `${p.shirt ? `${p.shirt}. ` : ""}${p.name}` : "Joueuse";

  return (
    <div>
      <PageHeader eyebrow={`${s.title} · ${CONTEXT_LABELS[s.context as Context]} · ${formatDate(s.evaluated_on)}`} title={name}
        description={`Référentiel v${version.versionNo}. Statut de l'évaluation : ${WORKFLOW_LABELS[s.status]}.${locked && !editable ? " Évaluation validée : lecture seule." : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {prev ? <Button asChild variant="outline" size="sm"><Link href={`/performance/evaluations/${s.id}/joueuses/${prev}`}><ChevronLeft />{byId.get(prev)?.short ?? "Précédente"}</Link></Button> : null}
            {next ? <Button asChild variant="outline" size="sm"><Link href={`/performance/evaluations/${s.id}/joueuses/${next}`}>{byId.get(next)?.short ?? "Suivante"}<ChevronRight /></Link></Button> : null}
            <Button asChild size="sm"><Link href={`/performance/evaluations/${s.id}`}>Retour à l&apos;évaluation</Link></Button>
          </div>
        } />
      <PerfNav />
      <ScoreSheet
        key={ev.id}
        evaluation={{
          id: ev.id,
          frameworkKey: ev.framework_key as FrameworkKey,
          minutes: ev.minutes_played,
          comment: ev.comment,
          scores: ev.evaluation_scores.map((x) => ({ criterionId: x.criterion_id, score: x.score, fact: x.fact, interpretation: x.interpretation })),
        }}
        version={version}
        editable={editable}
        context={s.context as Context}
      />
    </div>
  );
}
