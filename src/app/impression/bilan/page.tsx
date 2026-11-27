import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periods as listPeriods, squadIndices, VALIDATED } from "@/lib/performance/data";
import { teamIndices } from "@/lib/performance/collective-data";
import { DIMENSIONS, levelOf, teamDimensionIndices } from "@/lib/performance/engine";
import { HOME_AWAY_LABELS } from "@/lib/phase2/labels";
import { resultOf } from "@/lib/tactics/data";
import { pickPeriod } from "@/components/performance/period-picker";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { H } from "@/components/reports/section-title";

export const metadata = { title: "Bilan périodique" };

const f = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const d = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

export default async function PeriodicReview({ searchParams }: PageProps<"/impression/bilan">) {
  const ctx = await requirePermission("evaluations.read");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const period = pickPeriod(await listPeriods(ctx, today), sp.periode);
  const from = period.from ?? "1900-01-01";
  const to = period.to ?? today;
  const supabase = await createClient();
  const [{ data: matches }, { data: sessions }, { data: evals }, { data: tests }, { data: tasks }, squad, coll] = await Promise.all([
    supabase.from("matches").select("id, kickoff_at, status, home_away, goals_for, goals_against, matchday, opponents(name)").eq("club_id", ctx.clubId)
      .gte("kickoff_at", `${from}T00:00:00Z`).lte("kickoff_at", `${to}T23:59:59Z`).order("kickoff_at"),
    supabase.from("training_sessions").select("id, training_attendance(status)").eq("club_id", ctx.clubId).gte("session_date", from).lte("session_date", to),
    supabase.from("evaluation_sessions").select("id").eq("club_id", ctx.clubId).in("status", [...VALIDATED]).gte("evaluated_on", from).lte("evaluated_on", to),
    supabase.from("technical_test_sessions").select("id").eq("club_id", ctx.clubId).in("status", [...VALIDATED]).gte("tested_on", from).lte("tested_on", to),
    supabase.from("staff_tasks").select("status").eq("club_id", ctx.clubId).gte("created_at", `${from}T00:00:00Z`).lte("created_at", `${to}T23:59:59Z`),
    squadIndices(ctx, period),
    teamIndices(ctx, period),
  ]);
  const played = (matches ?? []).filter((m) => resultOf(m));
  const res = (k: string) => played.filter((m) => resultOf(m) === k).length;
  const bp = played.reduce((a, m) => a + (m.goals_for ?? 0), 0);
  const bc = played.reduce((a, m) => a + (m.goals_against ?? 0), 0);
  const att = (sessions ?? []).flatMap((s) => (s.training_attendance ?? []) as { status: string }[]);
  const presentRate = att.length ? Math.round((att.filter((a) => a.status === "present" || a.status === "retard").length / att.length) * 1000) / 10 : null;
  const team = teamDimensionIndices(squad.rows.map((r) => r.indices), squad.min);
  return (
    <>
      <PrintToolbar filename={`bilan-${period.key}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Bilan périodique" subtitle={period.label} reference={`Du ${d(period.from)} au ${d(to)}`} />

        <H>Compétition</H>
        <table className="mb-2">
          <tbody>
            <tr><th style={{ width: "34%" }}>Matchs joués</th><td>{played.length} · {res("V")} victoire(s), {res("N")} nul(s), {res("D")} défaite(s)</td></tr>
            <tr><th>Buts</th><td>{bp} marqué(s), {bc} encaissé(s) · différence {bp - bc >= 0 ? "+" : ""}{bp - bc}</td></tr>
            <tr><th>Points</th><td>{res("V") * 3 + res("N")}</td></tr>
          </tbody>
        </table>
        {(matches ?? []).length ? (
          <table>
            <thead><tr><th style={{ width: 80 }}>Date</th><th>Adversaire</th><th>Lieu</th><th style={{ width: 90 }}>Résultat</th></tr></thead>
            <tbody>{(matches ?? []).map((m) => <tr key={m.id}><td>{d(m.kickoff_at.slice(0, 10))}</td><td>{(m.opponents as unknown as { name: string } | null)?.name}{m.matchday ? ` (${m.matchday})` : ""}</td><td>{HOME_AWAY_LABELS[m.home_away]}</td><td>{resultOf(m) ? `${resultOf(m)} ${m.goals_for}-${m.goals_against}` : m.status === "programme" ? "À venir" : m.status}</td></tr>)}</tbody>
          </table>
        ) : null}

        <H>Entraînement et évaluation</H>
        <table>
          <tbody>
            <tr><th style={{ width: "34%" }}>Séances d&apos;entraînement</th><td>{(sessions ?? []).length} · taux de présence {presentRate == null ? "non renseigné" : `${f(presentRate)} %`}</td></tr>
            <tr><th>Évaluations individuelles validées</th><td>{(evals ?? []).length} séance(s)</td></tr>
            <tr><th>Séances de tests validées</th><td>{(tests ?? []).length}</td></tr>
            <tr><th>Évaluations collectives validées</th><td>{coll.team?.observations ?? 0}</td></tr>
            <tr><th>Tâches du staff</th><td>{(tasks ?? []).length} créée(s), {(tasks ?? []).filter((t) => t.status === "terminee").length} terminée(s)</td></tr>
          </tbody>
        </table>

        <H>Indicateurs de performance</H>
        <table>
          <tbody>
            <tr><th style={{ width: "34%" }}>IPI moyen de l&apos;effectif</th><td>{team.ipi == null ? "Données insuffisantes" : `${f(team.ipi)} · ${team.players} joueuse(s) au-dessus du seuil`}</td></tr>
            {DIMENSIONS.map((dim) => <tr key={dim.code}><th>{dim.label}</th><td>{team.dims[dim.code].index == null ? "Non évalué" : `${f(team.dims[dim.code].index)} · ${levelOf(team.dims[dim.code].index)}`}</td></tr>)}
            <tr><th>IPC · performance collective</th><td>{coll.team?.ipc == null ? "Données insuffisantes" : `${f(coll.team.ipc)} · ${levelOf(coll.team.ipc)}`}</td></tr>
            <tr><th>IMP · maîtrise du projet de jeu</th><td>{coll.team?.imp == null ? "—" : `${f(coll.team.imp)} %`}</td></tr>
          </tbody>
        </table>

        <div className="mt-6 text-sm">
          <p className="font-semibold">Commentaire du staff</p>
          <div className="mt-1 h-28 rounded border border-dashed" />
        </div>
        <p className="mt-3 text-[10px] text-[#667]">Données issues des matchs enregistrés, des présences saisies et des évaluations validées. Les moyennes de l&apos;effectif ne remplacent pas l&apos;IPC, calculé séparément à partir des évaluations collectives.</p>
        <DocFooter note="Bilan périodique — Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}
