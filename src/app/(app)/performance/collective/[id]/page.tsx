import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { getApprovalHistory } from "@/lib/phase2/data";
import { listCompactnessTargets, listSystems, loadCollectiveEvaluation } from "@/lib/performance/collective-data";
import { deleteCollectiveEvaluation } from "@/lib/performance/game-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { CollectiveMeta, CollectiveSheet, CollectiveWorkflow } from "@/components/game/collective";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Évaluation collective" };

export default async function CollectiveEvaluationPage({ params, searchParams }: PageProps<"/performance/collective/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadCollectiveEvaluation(id);
  if (!data) notFound();
  const { evaluation: e, version, scores, measures } = data;
  const [targets, systems, history] = await Promise.all([listCompactnessTargets(ctx), listSystems(ctx), getApprovalHistory("collective_evaluations", e.id)]);
  const locked = ["valide", "publie", "archive"].includes(e.status);
  const canWrite = can(ctx, "evaluations.write") && (!locked || can(ctx, "evaluations.validate"));
  const match = e.matches as unknown as { id: string; kickoff_at: string; opponents: { name: string } | null } | null;
  const session = e.training_sessions as unknown as { id: string; number: number; theme: string | null } | null;

  return (
    <div>
      <PageHeader eyebrow={`${e.context === "match" ? "Compétition" : "Entraînement"} · ${formatDate(e.evaluated_on)} · projet de jeu v${version.versionNo}`} title={e.title}
        description="Les notes sont enregistrées automatiquement. Elles entrent dans les indices collectifs une fois l'évaluation validée."
        actions={<Button asChild variant="outline"><Link href="/performance/collective">Performance collective</Link></Button>} />
      <PerfNav />
      {sp.nouvelle ? <div className="mb-4"><Notice>Évaluation créée en brouillon. Notez chaque principe observé de 1 à 5, laissez N/E sinon.</Notice></div> : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <CollectiveWorkflow id={e.id} status={e.status} canWrite={can(ctx, "evaluations.write")} canValidate={can(ctx, "evaluations.validate")} />
          <ApprovalHistory items={history} />
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm">
          {match ? <p className="mb-2">Match : <Link className="font-semibold hover:underline" href={`/competition/rencontres/${match.id}`}>{formatDate(match.kickoff_at.slice(0, 10))}{match.opponents ? ` · ${match.opponents.name}` : ""}</Link></p> : null}
          {session ? <p className="mb-2">Séance : <Link className="font-semibold hover:underline" href={`/entrainement/seances/${session.id}`}>n°{session.number}{session.theme ? ` · ${session.theme}` : ""}</Link></p> : null}
          <CollectiveMeta id={e.id} title={e.title} date={e.evaluated_on} notes={e.notes} systemId={e.system_id}
            systems={systems.filter((s) => !s.parent_id).map((s) => ({ id: s.id, name: s.name }))} editable={canWrite} />
        </div>
      </div>

      <CollectiveSheet evaluationId={e.id} version={version} initialScores={scores} initialMeasures={measures} targets={targets} editable={canWrite} />

      {canWrite ? (
        <div className="mt-8 border-t pt-4">
          <ActionButton action={deleteCollectiveEvaluation.bind(null, e.id)} confirm="Supprimer définitivement">Supprimer cette évaluation collective</ActionButton>
        </div>
      ) : null}
    </div>
  );
}
