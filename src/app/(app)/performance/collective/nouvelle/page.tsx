import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches } from "@/lib/phase2/data";
import { getGameModel, listSystems } from "@/lib/performance/collective-data";
import { PageHeader } from "@/components/ui/page-header";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { NewCollectiveForm } from "@/components/game/collective";

export const metadata = { title: "Nouvelle évaluation collective" };

export default async function NewCollectivePage({ searchParams }: PageProps<"/performance/collective/nouvelle">) {
  const ctx = await requirePermission("evaluations.write");
  const sp = await searchParams;
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [model, systems, matches, { data: sessions }] = await Promise.all([
    getGameModel(ctx),
    listSystems(ctx),
    listMatches(ctx, { seasonId: scope.seasonId, to: today, ascending: false }),
    supabase.from("training_sessions").select("id, number, session_date, theme").eq("club_id", ctx.clubId).lte("session_date", today)
      .order("session_date", { ascending: false }).limit(60),
  ]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <div>
      <PageHeader eyebrow="Performance collective" title="Nouvelle évaluation collective"
        description="Évaluez l'équipe sur les principes du projet de jeu, les secteurs et les relations entre lignes. Les critères non observés restent N/E et ne pénalisent pas." />
      <PerfNav />
      {!model?.published ? <Notice tone="warning">Aucun projet de jeu publié : publiez d&apos;abord le projet de jeu.</Notice> : (
        <NewCollectiveForm
          today={today}
          versionLabel={`v${model.published.version_no} · ${model.published.label}`}
          initialMatch={one(sp.match)}
          initialSession={one(sp.seance)}
          systems={systems.filter((s) => !s.parent_id).map((s) => ({ id: s.id, name: s.name, isReference: s.is_reference }))}
          matches={matches.map((m) => ({ id: m.id, date: m.kickoff_at.slice(0, 10), label: `${m.kickoff_at.slice(0, 10).split("-").reverse().join("/")} · ${m.home_away === "exterieur" ? `${m.opponent} – YFC` : `YFC – ${m.opponent}`}${m.matchday ? ` (${m.matchday})` : ""}` }))}
          sessions={(sessions ?? []).map((s) => ({ id: s.id, date: s.session_date, label: `${s.session_date.split("-").reverse().join("/")} · Séance n°${s.number}${s.theme ? ` · ${s.theme}` : ""}` }))}
        />
      )}
    </div>
  );
}
