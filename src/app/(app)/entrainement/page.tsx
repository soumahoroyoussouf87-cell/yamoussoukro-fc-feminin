import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { dayShort, hm, todayIso, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { addDays, mondayOf } from "@/lib/domain/match-day";
import { APPRECIATION_LABELS, scoreCriteria, parseCriteria } from "@/lib/training/evaluation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Entraînement" };

export default async function TrainingDashboard() {
  const ctx = await requirePermission("planning.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const today = todayIso();
  const { data } = await supabase
    .from("training_sessions")
    .select("id, number, session_date, starts_at, ends_at, theme, status, planned_rpe, training_attendance(status, minutes, rpe), session_evaluations(criteria, appreciation)")
    .eq("club_id", ctx.clubId)
    .eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000")
    .order("session_date");
  const sessions = data ?? [];
  const past = sessions.filter((s) => s.session_date <= today);
  const upcoming = sessions.filter((s) => s.session_date >= today).slice(0, 5);
  const byStatus = new Map<string, number>();
  for (const s of sessions) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

  // Assiduité : présentes ou en retard / présences saisies, sur les séances passées.
  let marked = 0, present = 0;
  for (const s of past) for (const a of s.training_attendance ?? []) { marked++; if (a.status === "present" || a.status === "retard") present++; }
  const attendanceRate = marked ? Math.round((present / marked) * 100) : null;

  // Charge hebdomadaire : sRPE moyen par joueuse notée, sommé sur la semaine (8 dernières semaines).
  const thisMonday = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, k) => addDays(thisMonday, (k - 7) * 7));
  const weekLoad = weeks.map((w) => {
    let total = 0;
    let rated = 0;
    for (const s of past.filter((x) => mondayOf(x.session_date) === w)) {
      const r = (s.training_attendance ?? []).filter((a) => a.minutes != null && a.rpe != null);
      if (r.length) { total += r.reduce((acc, a) => acc + a.minutes! * a.rpe!, 0) / r.length; rated++; }
    }
    return { week: w, load: Math.round(total), sessions: rated };
  });
  const maxLoad = Math.max(1, ...weekLoad.map((w) => w.load));
  const hasLoad = weekLoad.some((w) => w.load > 0);

  const evaluated = past
    .map((s) => {
      const ev = Array.isArray(s.session_evaluations) ? s.session_evaluations[0] : s.session_evaluations;
      return ev ? { s, score: scoreCriteria(parseCriteria(ev.criteria)), appreciation: ev.appreciation } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const scored = evaluated.filter((e) => e.score);
  const avgScore = scored.length ? Math.round(scored.reduce((a, e) => a + e.score!.pct, 0) / scored.length) : null;

  const kpis: [string, string, string][] = [
    ["Séances de la saison", String(sessions.length), `${past.length} réalisées ou du jour`],
    ["Assiduité", attendanceRate == null ? "—" : `${attendanceRate} %`, marked ? `${marked} présences saisies` : "Aucune présence saisie"],
    ["Charge cette semaine", weekLoad[7].load ? `${weekLoad[7].load} UA` : "—", "sRPE moyen par joueuse"],
    ["Évaluation moyenne", avgScore == null ? "—" : `${avgScore} %`, `${scored.length} séance(s) évaluée(s)`],
  ];

  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Tableau de bord" description={scope.club.season ? `Saison ${scope.club.season.label}` : undefined}
        actions={can(ctx, "planning.write") ? <Button asChild><Link href="/entrainement/seances/nouvelle"><Plus />Créer une séance</Link></Button> : null} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([k, v, h]) => (
          <Card key={k} className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{k}</p>
            <p className="font-display text-3xl font-bold">{v}</p>
            <p className="text-xs text-muted-foreground">{h}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Charge hebdomadaire</CardTitle><CardDescription>Somme, sur la semaine, du sRPE moyen par joueuse (UA). 8 dernières semaines.</CardDescription></CardHeader>
          <CardContent>
            {hasLoad ? (
              <figure>
                <div className="flex h-44 items-end gap-2 border-b border-border" role="img" aria-label="Charge hebdomadaire des 8 dernières semaines">
                  {weekLoad.map((w) => (
                    <div key={w.week} className="group relative flex h-full flex-1 flex-col justify-end">
                      <span className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-background group-hover:block">
                        Semaine du {dayShort(w.week)} : {w.load} UA · {w.sessions} séance(s) notée(s)
                      </span>
                      <div className="mx-auto w-full max-w-10 rounded-t bg-primary" style={{ height: `${(w.load / maxLoad) * 100}%`, minHeight: w.load ? 2 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-2 text-center text-[10px] text-muted-foreground">
                  {weekLoad.map((w) => <span key={w.week} className="flex-1">{dayShort(w.week).replace(/^\S+\s/, "")}</span>)}
                </div>
                <table className="sr-only"><caption>Charge par semaine</caption><tbody>{weekLoad.map((w) => <tr key={w.week}><th>{w.week}</th><td>{w.load} UA</td></tr>)}</tbody></table>
              </figure>
            ) : <p className="text-sm text-muted-foreground">Aucune charge saisie : renseigne les minutes et le RPE des joueuses à l&apos;étape 6 des fiches.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Prochaines séances</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs capitalize text-muted-foreground">{dayShort(s.session_date)}{s.starts_at ? ` · ${hm(s.starts_at)}` : ""}</span>
                    <Link href={`/entrainement/seances/${s.id}`} className="flex-1 truncate font-semibold hover:underline">n°{s.number} · {s.theme ?? "Sans thème"}</Link>
                    <Badge variant={workflowVariant(s.status)}>{WORKFLOW_LABELS[s.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={ClipboardList} title="Aucune séance à venir" description="Crée une séance ou planifie la semaine." />}
            {sessions.length ? <p className="mt-3 text-xs text-muted-foreground">{[...byStatus].map(([k, n]) => `${WORKFLOW_LABELS[k]} : ${n}`).join(" · ")}</p> : null}
          </CardContent>
        </Card>
      </div>
      {evaluated.length ? (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Dernières évaluations</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {evaluated.slice(-6).reverse().map(({ s, score, appreciation }) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs capitalize text-muted-foreground">{dayShort(s.session_date)}</span>
                  <Link href={`/entrainement/seances/${s.id}?etape=7`} className="flex-1 truncate hover:underline">n°{s.number} · {s.theme ?? "Sans thème"}</Link>
                  {score ? <strong>{score.pct} %</strong> : null}
                  {appreciation ? <Badge variant="outline">{APPRECIATION_LABELS[appreciation]}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {[["Fiches de séance", "/entrainement/seances"], ["Bibliothèque d'exercices", "/entrainement/exercices"], ["Schémas tactiques", "/entrainement/schemas"], ["Thèmes", "/entrainement/themes"], ["Modèles de séance", "/entrainement/modeles"]].map(([l, h]) => (
          <Button key={h} asChild variant="outline" size="sm"><Link href={h}>{l}</Link></Button>
        ))}
      </div>
    </>
  );
}
