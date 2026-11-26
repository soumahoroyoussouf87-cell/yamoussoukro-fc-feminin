import Link from "next/link";
import {
  AlertTriangle, CalendarClock, CheckCircle2, CircleSlash, Clapperboard, ClipboardList, FileBarChart, Goal, Lock,
  Shield, Shirt, ShieldAlert, Target, Trophy, UserPlus, Users, UserX, Video,
} from "lucide-react";
import { requirePermission, can } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { getDashboardData } from "@/lib/data/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClubLogo } from "@/components/shell/club-logo";
import { formatDateTime } from "@/lib/utils";

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
  { title: "Classement du championnat", phase: 2, icon: Trophy, text: "Résultats et classement." },
  { title: "Prochaine séance", phase: 2, icon: ClipboardList, text: "Fiches de séance." },
  { title: "Programme hebdomadaire", phase: 2, icon: CalendarClock, text: "Microcycles J-6 à J+1." },
  { title: "Système de jeu de référence", phase: 3, icon: Shield, text: "Projet de jeu et systèmes." },
  { title: "Joueuse en focus · radar", phase: 3, icon: Target, text: "Évaluations validées." },
  { title: "Progression collective", phase: 3, icon: FileBarChart, text: "Courbe de l'IPC." },
  { title: "Dernières séquences vidéo", phase: 4, icon: Clapperboard, text: "Video Analysis Center." },
  { title: "Objectifs de développement", phase: 4, icon: Goal, text: "Plans de développement." },
];

const INDICES = ["Technique", "Tactique", "Athlétique", "Cognitif", "Mental", "Comportemental", "Collectif", "Progression générale"];

export default async function DashboardPage() {
  const ctx = await requirePermission("dashboard.read");
  const club = await getClubHeader(ctx);
  const d = await getDashboardData(ctx, club);
  const r = d.record;
  const unavailable = d.availability.indisponible;
  const limited = d.availability.incertaine + d.availability.restreinte;
  const maxLine = Math.max(1, ...d.lines.map((l) => l.count));

  const quick = [
    { label: "Ajouter une joueuse", icon: UserPlus, href: can(ctx, "players.write") ? "/effectif/nouvelle" : undefined, phase: 1 },
    { label: "Ajouter un membre du staff", icon: Users, href: can(ctx, "staff.write") ? "/staff/nouveau" : undefined, phase: 1 },
    { label: "Créer une séance", icon: ClipboardList, phase: 2 },
    { label: "Créer un match", icon: Trophy, phase: 2 },
    { label: "Créer une convocation", icon: FileBarChart, phase: 2 },
    { label: "Composer le onze", icon: Shirt, phase: 2 },
    { label: "Évaluer une joueuse", icon: Target, phase: 3 },
    { label: "Importer une vidéo", icon: Video, phase: 4 },
    { label: "Créer un objectif", icon: Goal, phase: 4 },
    { label: "Générer un rapport", icon: FileBarChart, phase: 3 },
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
          Le classement sera calculé avec le module Résultats &amp; Classement (Phase 2). Les matchs sont saisis dans le Match Center (Phase 2).
        </p>
      </section>

      {/* Indices de performance */}
      <section aria-labelledby="indices-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="indices-title" className="font-display text-xl font-bold uppercase tracking-wide">Indices de performance</h2>
          <Badge variant="outline">Performance Framework — Phase 3</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {INDICES.map((label) => (
            <div key={label} className="rounded-xl border bg-card p-4" title="Aucune évaluation enregistrée : l'indice n'est pas calculé.">
              <p className="hyphens-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-lg font-semibold text-muted-foreground">Non évalué</p>
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
                <p className="font-display text-2xl font-bold uppercase">{d.nextMatch.opponent}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(d.nextMatch.kickoff_at)} · {d.nextMatch.home_away === "domicile" ? "Domicile" : d.nextMatch.home_away === "exterieur" ? "Extérieur" : "Terrain neutre"}
                  {d.nextMatch.venue ? ` · ${d.nextMatch.venue}` : ""}
                </p>
              </div>
            ) : (
              <EmptyState icon={Trophy} title="Aucun match programmé" description="Le calendrier des rencontres sera saisi dans le Match Center (Phase 2)." />
            )}
          </CardContent>
        </Card>

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
            {UPCOMING.map((w) => {
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
