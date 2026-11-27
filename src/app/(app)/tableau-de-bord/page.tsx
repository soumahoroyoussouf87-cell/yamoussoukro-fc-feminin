import Link from "next/link";
import { TeamLogo } from "@/components/phase2/team-logo";
import {
  AlertTriangle, CalendarClock, CheckCircle2, CircleSlash, Clapperboard, ClipboardList, FileBarChart, Goal, Lock,
  Shield, Shirt, ShieldAlert, Target, Trophy, UserPlus, Users, UserX, Video,
} from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClubHeader } from "@/lib/club";
import { getDashboardData } from "@/lib/data/dashboard";
import { getPhase2Widgets } from "@/lib/data/dashboard-phase2";
import { dayShort, hm, INTENSITY_LABELS } from "@/lib/phase2/labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClubLogo } from "@/components/shell/club-logo";
import { formatDate, formatDateTime } from "@/lib/utils";
import { squadIndices } from "@/lib/performance/data";
import { teamIndices } from "@/lib/performance/collective-data";
import { levelOf } from "@/lib/performance/engine";
import { DIMENSIONS, fmtDelta, FRAMEWORK_KEY_LABELS, teamDimensionIndices } from "@/lib/performance/engine";
import { Radar } from "@/components/performance/charts";

export const metadata = { title: "Tableau de bord" };

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "success" | "danger" | "warning" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const UPCOMING = [
  { title: "Joueuse en focus · radar", phase: 3, icon: Target, text: "Évaluations validées." },
  { title: "Dernières séquences vidéo", phase: 4, icon: Clapperboard, text: "Video Analysis Center." },
  { title: "Objectifs de développement", phase: 4, icon: Goal, text: "Plans de développement." },
];

const fmtIdx = (n: number) => String(n).replace(".", ",");

export default async function DashboardPage() {
  const ctx = await requirePermission("dashboard.read");
  const club = await getClubHeader(ctx);
  const [d, w] = await Promise.all([getDashboardData(ctx, club), getPhase2Widgets(ctx)]);
  const r = d.record;
  const unavailable = d.availability.indisponible;
  const limited = d.availability.incertaine + d.availability.restreinte;
  const maxLine = Math.max(1, ...d.lines.map((l) => l.count));
  const perf = can(ctx, "evaluations.read") && club.season
    ? await squadIndices(ctx, { from: club.season.starts_on, to: club.season.ends_on })
    : null;
  const supabase = await createClient();
  const { data: meStaff } = await supabase.from("staff_members").select("id").eq("club_id", ctx.clubId).eq("profile_id", ctx.userId).maybeSingle();
  const { data: myTasks } = meStaff
    ? await supabase.from("staff_tasks").select("id, title, due_on, priority").eq("assignee_staff_id", meStaff.id).in("status", ["a_faire", "en_cours"])
      .order("due_on", { ascending: true, nullsFirst: false }).limit(5)
    : { data: [] as { id: string; title: string; due_on: string | null; priority: string }[] };
  const todayIso = new Date().toISOString().slice(0, 10);
  const coll = perf && club.season ? await teamIndices(ctx, { from: club.season.starts_on, to: club.season.ends_on }) : null;
  const team = perf ? teamDimensionIndices(perf.rows.map((x) => x.indices), perf.min) : null;
  const focus = perf?.rows.filter((x) => x.indices.observations > 0).sort((a, b) => (b.indices.to ?? "").localeCompare(a.indices.to ?? ""))[0] ?? null;
  const upcoming = focus ? UPCOMING.filter((u) => !u.title.startsWith("Joueuse en focus")) : UPCOMING;
  const idis = (perf?.rows ?? []).map((x) => x.idi).filter((v): v is number => v != null);
  const idi = idis.length ? Math.round((idis.reduce((a, b) => a + b, 0) / idis.length) * 10) / 10 : null;
  const indexTiles: { label: string; value: number | null; hint: string; text?: string }[] = [
    ...DIMENSIONS.map((dim) => ({
      label: dim.label,
      value: team?.dims[dim.code].index ?? null,
      hint: team?.dims[dim.code].index != null ? `${team.dims[dim.code].players} joueuse(s) · saison` : "Aucune évaluation validée au-dessus du seuil",
    })),
    {
      label: "Collectif (IPC)", value: coll?.team?.ipc ?? null,
      hint: !coll?.reference ? "Publiez le projet de jeu" : coll.team?.ipc != null ? `${levelOf(coll.team.ipc)} · ${coll.team.observations} évaluation(s) collective(s)` : `Données insuffisantes (${coll.team?.observations ?? 0}/${coll.min} évaluations collectives)`,
    },
    {
      label: "Progression générale (IDI)", value: idi, text: idi == null ? undefined : fmtDelta(idi),
      hint: idi == null ? "Il faut deux mesures comparables par joueuse" : `Moyenne de ${idis.length} joueuse(s) · saison`,
    },
  ];

  const quick = [
    { label: "Ajouter une joueuse", icon: UserPlus, href: can(ctx, "players.write") ? "/effectif/nouvelle" : undefined, phase: 1 },
    { label: "Ajouter un membre du staff", icon: Users, href: can(ctx, "staff.write") ? "/staff/nouveau" : undefined, phase: 1 },
    { label: "Créer une séance", icon: ClipboardList, href: can(ctx, "planning.write") ? "/entrainement/seances/nouvelle" : undefined, phase: 1 },
    { label: "Créer un match", icon: Trophy, href: can(ctx, "matches.write") ? "/competition/rencontres/nouvelle" : undefined, phase: 1 },
    { label: "Créer une convocation", icon: FileBarChart, href: can(ctx, "matches.write") ? "/competition/convocations" : undefined, phase: 1 },
    { label: "Composer le onze", icon: Shirt, href: can(ctx, "lineups.write") ? "/competition/onze-de-depart" : undefined, phase: 1 },
    { label: "Évaluer une joueuse", icon: Target, href: can(ctx, "evaluations.write") ? "/performance/evaluations/nouvelle" : undefined, phase: 3 },
    { label: "Évaluer le collectif", icon: Shield, href: can(ctx, "evaluations.write") ? "/performance/collective/nouvelle" : undefined, phase: 3 },
    { label: "Importer une vidéo", icon: Video, phase: 4 },
    { label: "Créer un objectif", icon: Goal, phase: 4 },
    { label: "Générer un rapport", icon: FileBarChart, href: can(ctx, "evaluations.read") ? "/rapports/performance" : undefined, phase: 3 },
    { label: "Créer une tâche", icon: ClipboardList, href: "/taches", phase: 3 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Bandeau institutionnel */}
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <ClubLogo src={club.logoUrl ?? undefined} size={84} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia">Centre de Haute Performance</p>
              <h1 className="font-display text-3xl font-extrabold uppercase leading-none sm:text-5xl">{club.name}</h1>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
                Observer • Évaluer • Planifier • Développer • Performer
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm md:text-right">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/60">Saison active</dt>
              <dd className="font-display text-xl font-bold">{club.season?.label ?? "Non définie"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/60">Compétition</dt>
              <dd className="font-display text-xl font-bold">{club.competition?.name ?? "Non définie"}</dd>
            </div>
          </dl>
        </div>
        {!club.season && can(ctx, "settings.manage") ? (
          <p className="mt-4 rounded-md bg-white/10 px-3 py-2 text-sm">
            Aucune saison active. <Link className="font-semibold underline" href="/administration/parametres">Créer la saison dans les paramètres</Link>.
          </p>
        ) : null}
      </section>

      {/* Indicateurs clés */}
      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">Indicateurs clés</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Effectif total" value={d.squadTotal} hint={d.squadScope === "saison" ? "Inscrites sur la saison" : "Fiches actives du club"} />
          <Kpi label="Disponibles" value={d.availability.disponible} tone="success" />
          <Kpi label="Indisponibles" value={unavailable} tone={unavailable ? "danger" : undefined} hint={limited ? `+ ${limited} incertaine(s) ou restreinte(s)` : undefined} />
          <Kpi label="Matchs joués" value={r ? r.played : "—"} hint={r ? undefined : "Aucune saison active"} />
          <Kpi label="V / N / D" value={r ? `${r.wins}/${r.draws}/${r.losses}` : "—"} />
          <Kpi label="Buts pour / contre" value={r ? `${r.goalsFor}/${r.goalsAgainst}` : "—"} hint={r ? `${r.cleanSheets} clean sheet(s)` : undefined} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bilan calculé sur les matchs au statut « Joué ». Les scores se saisissent dans le Match Center (après-match).
        </p>
      </section>

      {/* Indices de performance */}
      <section aria-labelledby="indices-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="indices-title" className="font-display text-xl font-bold uppercase tracking-wide">Indices de performance</h2>
          {can(ctx, "evaluations.read") ? <Link href="/performance/individuelle" className="text-sm font-semibold text-primary-text hover:underline">Performance individuelle</Link> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {indexTiles.map((t) => (
            <div key={t.label} className="rounded-xl border bg-card p-4" title={t.hint}>
              <p className="hyphens-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
              {t.value == null
                ? <p className="mt-1 font-display text-lg font-semibold text-muted-foreground">Non évalué</p>
                : <p className="mt-1 font-display text-3xl font-bold tabular-nums">{t.text ?? fmtIdx(t.value)}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{t.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Disponibilité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disponibilité de l&apos;effectif</CardTitle>
            <CardDescription>Statut sportif du jour (aucune donnée médicale)</CardDescription>
          </CardHeader>
          <CardContent>
            {d.squadTotal === 0 ? (
              <EmptyState icon={Users} title="Aucune joueuse enregistrée" description="Ajoutez les joueuses de l'effectif pour suivre leur disponibilité." />
            ) : (
              <>
                <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Disponibles ${d.availability.disponible}, incertaines ${d.availability.incertaine}, restreintes ${d.availability.restreinte}, indisponibles ${unavailable}`}>
                  {(["disponible", "incertaine", "restreinte", "indisponible"] as const).map((k) =>
                    d.availability[k] ? (
                      <span
                        key={k}
                        title={`${k} : ${d.availability[k]}`}
                        className={k === "disponible" ? "bg-success" : k === "indisponible" ? "bg-danger" : "bg-warning"}
                        style={{ width: `${(d.availability[k] / d.squadTotal) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden />Disponibles <strong className="ml-auto tabular-nums">{d.availability.disponible}</strong></li>
                  <li className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" aria-hidden />Incertaines <strong className="ml-auto tabular-nums">{d.availability.incertaine}</strong></li>
                  <li className="flex items-center gap-2"><ShieldAlert className="size-4 text-warning" aria-hidden />Restreintes <strong className="ml-auto tabular-nums">{d.availability.restreinte}</strong></li>
                  <li className="flex items-center gap-2"><UserX className="size-4 text-danger" aria-hidden />Indisponibles <strong className="ml-auto tabular-nums">{unavailable}</strong></li>
                </ul>
                <Link href="/disponibilites" className="mt-4 inline-block text-sm font-semibold text-primary-text hover:underline">Gérer les disponibilités</Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Effectif par secteur */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Effectif par secteur</CardTitle>
            <CardDescription>Selon le poste principal renseigné</CardDescription>
          </CardHeader>
          <CardContent>
            {d.squadTotal === 0 ? (
              <EmptyState icon={Shield} title="Aucune donnée" description="La répartition apparaîtra dès l'ajout des joueuses et de leur poste." />
            ) : (
              <ul className="flex flex-col gap-3">
                {d.lines.map((l) => (
                  <li key={l.line} className="text-sm" title={`${l.label} : ${l.count} joueuse(s)`}>
                    <div className="mb-1 flex justify-between"><span>{l.label}</span><span className="font-semibold tabular-nums">{l.count}</span></div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-secondary dark:bg-[#3b6fd1]" style={{ width: `${(l.count / maxLine) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {d.withoutPosition ? <li className="text-xs text-muted-foreground">{d.withoutPosition} joueuse(s) sans poste principal</li> : null}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">La performance par secteur (IPS) sera calculée en Phase 3.</p>
          </CardContent>
        </Card>

        {/* Alertes et validations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertes et validations</CardTitle>
            <CardDescription>Points administratifs à traiter</CardDescription>
          </CardHeader>
          <CardContent>
            {d.alerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aucune alerte" description="Licences, documents et disponibilités sont à jour." />
            ) : (
              <ul className="flex flex-col gap-2">
                {d.alerts.slice(0, 8).map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-accent">
                      {a.level === "danger" ? <CircleSlash className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Alerte" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Vigilance" />}
                      {a.text}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Prochain match */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Prochain match</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {d.nextMatch ? (
              <div>
                <Link href="/competition/match-center" className="inline-flex items-center gap-3 font-display text-2xl font-bold uppercase hover:underline"><TeamLogo name={d.nextMatch.opponent} path={d.nextMatch.opponentLogo} size={40} />{d.nextMatch.opponent}</Link>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(d.nextMatch.kickoff_at)} · {d.nextMatch.home_away === "domicile" ? "Domicile" : d.nextMatch.home_away === "exterieur" ? "Extérieur" : "Terrain neutre"}
                  {d.nextMatch.venue ? ` · ${d.nextMatch.venue}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState icon={Trophy} title="Aucun match programmé" description="Saisissez le calendrier dans Compétition › Calendrier des rencontres." />
            )}
          </CardContent>
        </Card>

        {w.canPlanning ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Prochaine séance</CardTitle>
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              {w.nextSession ? (
                <Link href={`/entrainement/seances/${w.nextSession.id}`} className="block hover:underline">
                  <p className="font-display text-xl font-bold uppercase">Séance n°{w.nextSession.number} · {w.nextSession.theme}</p>
                  <p className="text-sm capitalize text-muted-foreground">{dayShort(w.nextSession.session_date)}{w.nextSession.starts_at ? ` · ${hm(w.nextSession.starts_at)}` : ""}{w.nextSession.intensity ? ` · intensité ${INTENSITY_LABELS[w.nextSession.intensity].toLowerCase()}` : ""}</p>
                </Link>
              ) : (
                <EmptyState icon={ClipboardList} title="Aucune séance planifiée" description="Créez les séances depuis le programme hebdomadaire." />
              )}
            </CardContent>
          </Card>
        ) : null}

        {w.canPlanning ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Programme de la semaine</CardTitle>
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {w.week.map((day) => (
                  <li key={day.date} className={`rounded-md border p-1 ${day.isToday ? "ring-2 ring-fuchsia" : ""}`}>
                    <p className="font-semibold capitalize">{dayShort(day.date).split(" ")[0]}</p>
                    <p className="font-display text-sm font-bold text-primary-text">{day.label ?? "·"}</p>
                    <p className="text-muted-foreground">{day.sessions ? `${day.sessions} S` : ""}{day.matches ? " M" : ""}{!day.sessions && !day.matches && day.events ? `${day.events} A` : ""}</p>
                  </li>
                ))}
              </ul>
              <Link href="/planification/programme" className="mt-3 inline-block text-sm font-semibold text-primary-text hover:underline">Ouvrir le programme</Link>
            </CardContent>
          </Card>
        ) : null}

        {w.canMatches ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Classement</CardTitle>
              <Trophy className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              {w.standings.length ? (
                <ol className="flex flex-col gap-1 text-sm">
                  {w.standings.map((r) => (
                    <li key={r.id} className={`flex justify-between rounded px-2 py-0.5 ${r.is_own_team ? "bg-fuchsia/10 font-semibold" : ""}`}>
                      <span><span className="mr-2 font-display font-bold">{r.position}</span>{r.team_name}</span><span className="tabular-nums">{r.points} pts</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState icon={Trophy} title="Classement non saisi" description="Saisissez le classement officiel dans Compétition › Classement." />
              )}
              <Link href="/competition/classement" className="mt-3 inline-block text-sm font-semibold text-primary-text hover:underline">Voir le classement</Link>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff</CardTitle>
            <CardDescription>Membres actifs enregistrés</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-bold tabular-nums">{d.staffActive}</p>
            {can(ctx, "staff.read") ? <Link href="/staff" className="text-sm font-semibold text-primary-text hover:underline">Voir le staff</Link> : null}
          </CardContent>
        </Card>
      </div>

      {focus ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Joueuse en focus · {focus.player.name}</CardTitle>
              <CardDescription>Dernière joueuse évaluée ({formatDate(focus.indices.to)}){focus.indices.frameworkKey ? ` · ${FRAMEWORK_KEY_LABELS[focus.indices.frameworkKey]}` : ""}</CardDescription>
            </div>
            <Link href={`/performance/individuelle/${focus.player.id}`} className="text-sm font-semibold text-primary-text hover:underline">Profil 360°</Link>
          </CardHeader>
          <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
            <Radar axes={DIMENSIONS.map((dim) => ({ label: dim.label, value: focus.indices.dims[dim.code].index, n: focus.indices.dims[dim.code].n }))} size={260} />
            <div className="text-sm">
              <p className="font-display text-4xl font-bold tabular-nums">{focus.indices.ipi == null ? <span className="text-base text-muted-foreground">IPI : données insuffisantes ({focus.indices.observations}/{perf?.min})</span> : <>IPI {fmtIdx(focus.indices.ipi)}</>}</p>
              <p className="text-muted-foreground">{focus.indices.observations} évaluation(s) validée(s) cette saison.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Widgets dont le module source n'est pas encore livré : signalés, sans donnée simulée */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Widgets à venir</CardTitle>
            <CardDescription>Ils s&apos;activeront automatiquement avec les modules de la roadmap. Aucune donnée n&apos;est simulée.</CardDescription>
          </div>
          <Lock className="size-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((w) => {
              const Icon = w.icon;
              return (
                <li key={w.title} className="flex items-start gap-3 rounded-lg border border-dashed p-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{w.title}</p>
                    <p className="text-xs text-muted-foreground">{w.text}</p>
                  </div>
                  <Badge variant="outline">P{w.phase}</Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Mes tâches */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div><CardTitle className="text-base">Mes tâches</CardTitle><CardDescription>Tâches qui vous sont confiées, par échéance.</CardDescription></div>
          <Button asChild variant="outline" size="sm"><Link href="/taches">Toutes les tâches</Link></Button>
        </CardHeader>
        <CardContent>
          {(myTasks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune tâche en cours pour vous.</p> : (
            <ul className="divide-y text-sm">
              {(myTasks ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">{t.priority === "haute" ? <Badge variant="warning" className="mr-1">Haute</Badge> : null}{t.title}</span>
                  <span className={`whitespace-nowrap text-xs ${t.due_on && t.due_on < todayIso ? "font-semibold text-danger" : "text-muted-foreground"}`}>{t.due_on ? t.due_on.split("-").reverse().join("/") : "Sans échéance"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Accès rapides */}
      <section aria-labelledby="quick-title">
        <h2 id="quick-title" className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Accès rapides</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {quick.map((q) => {
            const Icon = q.icon;
            return q.href ? (
              <Button key={q.label} asChild variant="outline" className="h-auto justify-start py-3">
                <Link href={q.href}><Icon aria-hidden />{q.label}</Link>
              </Button>
            ) : (
              <span
                key={q.label}
                aria-disabled="true"
                title={q.phase === 1 ? "Votre rôle ne permet pas cette action" : `Disponible en Phase ${q.phase}`}
                className="flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground"
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{q.label}</span>
                <span className="text-[10px] font-semibold">{q.phase === 1 ? <Lock className="size-3" aria-label="Non autorisé" /> : `P${q.phase}`}</span>
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
