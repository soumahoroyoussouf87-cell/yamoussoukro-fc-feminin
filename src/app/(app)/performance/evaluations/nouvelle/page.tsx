import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches } from "@/lib/phase2/data";
import { getFramework } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { NewEvaluationForm } from "@/components/performance/new-evaluation-form";

export const metadata = { title: "Nouvelle évaluation" };

export default async function NewEvaluationPage({ searchParams }: PageProps<"/performance/evaluations/nouvelle">) {
  const ctx = await requirePermission("evaluations.write");
  const sp = await searchParams;
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [fw, matches, { data: sessions }] = await Promise.all([
    getFramework(ctx),
    listMatches(ctx, { seasonId: scope.seasonId, to: today, ascending: false }),
    supabase.from("training_sessions").select("id, number, session_date, theme").eq("club_id", ctx.clubId).lte("session_date", today)
      .order("session_date", { ascending: false }).limit(60),
  ]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <div>
      <PageHeader eyebrow="Performance" title="Nouvelle évaluation"
        description="Choisissez le contexte. Vous ajouterez ensuite les joueuses et noterez chaque critère de 1 à 5, ou N/E s'il n'a pas pu être observé." />
      <PerfNav />
      {!fw?.published ? <Notice tone="warning">Aucun référentiel publié : publiez d&apos;abord un référentiel d&apos;évaluation.</Notice> : (
        <NewEvaluationForm
          today={today}
          versionLabel={`v${fw.published.version_no} · ${fw.published.label}`}
          initialMatch={one(sp.match)}
          initialSession={one(sp.seance)}
          matches={matches.map((m) => ({ id: m.id, date: m.kickoff_at.slice(0, 10), label: `${m.kickoff_at.slice(0, 10).split("-").reverse().join("/")} · ${m.home_away === "exterieur" ? `${m.opponent} – YFC` : `YFC – ${m.opponent}`}${m.matchday ? ` (${m.matchday})` : ""}` }))}
          sessions={(sessions ?? []).map((s) => ({ id: s.id, date: s.session_date, label: `${s.session_date.split("-").reverse().join("/")} · Séance n°${s.number}${s.theme ? ` · ${s.theme}` : ""}` }))}
        />
      )}
    </div>
  );
}
