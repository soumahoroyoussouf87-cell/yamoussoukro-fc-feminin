import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, listPlayerOptions } from "@/lib/phase2/data";
import { listProtocols, loadTestSession } from "@/lib/performance/data";
import { deleteTestSession } from "@/lib/performance/test-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { TestSessionMeta, TestSetup, TestSheet, TestWorkflow } from "@/components/performance/tests";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Séance de tests" };

export default async function TestSessionPage({ params, searchParams }: PageProps<"/performance/tests/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadTestSession(id);
  if (!data) notFound();
  const { session: s, results } = data;
  const supabase = await createClient();
  const [players, protocols, history] = await Promise.all([
    listPlayerOptions(ctx), listProtocols(ctx), getApprovalHistory("technical_test_sessions", s.id),
  ]);

  let suggested: Set<string> | null = null;
  let source = "Effectif complet";
  if (s.training_session_id) {
    const { data: att } = await supabase.from("training_attendance").select("player_id, status").eq("session_id", s.training_session_id);
    const ids = (att ?? []).filter((a) => a.status === "present" || a.status === "retard").map((a) => a.player_id);
    if (ids.length) { suggested = new Set(ids); source = "Joueuses présentes à la séance"; }
  }

  const locked = ["valide", "publie", "archive"].includes(s.status);
  const canWrite = can(ctx, "evaluations.write") && (!locked || can(ctx, "evaluations.validate"));
  const selProtocols = protocols.filter((p) => s.protocol_ids.includes(p.id));
  const byId = new Map(players.map((p) => [p.id, p]));
  const selPlayers = s.player_ids.map((pid) => byId.get(pid)).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => a.sort - b.sort);
  const initial = Object.fromEntries(results.map((r) => [`${r.protocol_id}|${r.player_id}`, {
    attempts: r.attempts, successes: r.successes, errors: r.errors, valueSeconds: r.value_seconds == null ? null : Number(r.value_seconds), notes: r.notes,
  }]));
  const linked = s.training_sessions as unknown as { id: string; number: number; theme: string | null } | null;
  const lite = (p: (typeof protocols)[number]) => ({ id: p.id, name: p.name, measure: p.measure, attempts: p.attempts, ref_best: p.ref_best, ref_limit: p.ref_limit, setup: p.setup, version_no: p.version_no });
  const visible = canWrite ? protocols.filter((p) => p.active || s.protocol_ids.includes(p.id)) : selProtocols;

  return (
    <div>
      <PageHeader eyebrow={`Tests techniques · ${formatDate(s.tested_on)}`} title={s.title}
        description="Les résultats sont enregistrés automatiquement. Ils entrent dans les profils une fois la séance validée."
        actions={<Button asChild variant="outline"><Link href="/performance/tests">Toutes les séances</Link></Button>} />
      <PerfNav />
      {sp.nouvelle ? <div className="mb-4"><Notice>Séance créée en brouillon. Cochez les joueuses testées puis saisissez les résultats.</Notice></div> : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <TestWorkflow id={s.id} status={s.status} canWrite={can(ctx, "evaluations.write")} canValidate={can(ctx, "evaluations.validate")} />
          <ApprovalHistory items={history} />
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm">
          {linked ? <p className="mb-2">Séance : <Link className="font-semibold hover:underline" href={`/entrainement/seances/${linked.id}`}>n°{linked.number}{linked.theme ? ` · ${linked.theme}` : ""}</Link></p> : null}
          <TestSessionMeta id={s.id} title={s.title} date={s.tested_on} location={s.location} conditions={s.conditions} notes={s.notes} editable={canWrite} />
        </div>
      </div>

      <div className="space-y-5">
        {canWrite ? (
          <TestSetup id={s.id} protocols={visible.map(lite)} selectedProtocols={s.protocol_ids} source={source}
            players={players.map((p) => ({ id: p.id, name: p.name, shirt: p.shirt, suggested: suggested ? suggested.has(p.id) : true }))}
            selectedPlayers={s.player_ids} />
        ) : null}
        {selProtocols.length ? (
          <TestSheet key={`${s.protocol_ids.join()}|${s.player_ids.join()}`} sessionId={s.id} protocols={selProtocols.map(lite)} initial={initial} editable={canWrite}
            players={selPlayers.map((p) => ({ id: p.id, name: p.name, shirt: p.shirt }))} />
        ) : null}
      </div>

      {canWrite ? (
        <div className="mt-8 border-t pt-4">
          <ActionButton action={deleteTestSession.bind(null, s.id)} confirm="Supprimer définitivement">Supprimer cette séance de tests</ActionButton>
        </div>
      ) : null}
    </div>
  );
}
