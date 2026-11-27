import { notFound } from "next/navigation";
import { TeamLogo } from "@/components/phase2/team-logo";
import { requirePermission } from "@/lib/auth";
import { getMatch, matchTitle } from "@/lib/phase2/data";
import { dayLong, dayOf, HOME_AWAY_LABELS, MATCH_STATUS_LABELS, timeOf, todayIso } from "@/lib/phase2/labels";
import { dayDiff } from "@/lib/domain/match-day";
import { Badge } from "@/components/ui/badge";
import { SubNav } from "@/components/phase2/sub-nav";

export default async function MatchLayout({ children, params }: LayoutProps<"/competition/rencontres/[id]">) {
  await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const day = dayOf(m.kickoff_at);
  const diff = dayDiff(todayIso(), day);
  const base = `/competition/rencontres/${id}`;
  return (
    <>
      <div className="hero-gradient mb-4 rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia">Match Center{m.competitions?.name ? ` · ${m.competitions.name}` : ""}{m.matchday ? ` · ${m.matchday}` : ""}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <TeamLogo name="Yamoussoukro FC" path="/brand/logo-officiel-yfc.png" size={52} className={m.home_away === "exterieur" ? "order-3" : ""} />
            <TeamLogo name={m.opponents?.name ?? "Adversaire"} path={m.opponents?.logo_path} size={52} className="order-2" />
            <h1 className="order-4 font-display text-3xl font-extrabold uppercase sm:text-4xl">{matchTitle(m)}</h1>
          </div>
          {m.status === "joue" ? <p className="font-display text-5xl font-extrabold tabular-nums">{m.home_away === "exterieur" ? `${m.goals_against} – ${m.goals_for}` : `${m.goals_for} – ${m.goals_against}`}</p> : null}
        </div>
        <p className="mt-1 text-sm text-white/80">
          <span className="capitalize">{dayLong(day)}</span> · {timeOf(m.kickoff_at)} · {HOME_AWAY_LABELS[m.home_away]}{m.venue ? ` · ${m.venue}` : ""}
        </p>
        <div className="mt-2 flex gap-2">
          <Badge className="bg-white/15 text-white">{MATCH_STATUS_LABELS[m.status]}</Badge>
          {m.status === "programme" && diff >= 0 ? <Badge className="bg-fuchsia text-white">{diff === 0 ? "Jour de match (J)" : `J-${diff}`}</Badge> : null}
        </div>
      </div>
      <SubNav items={[
        { href: base, label: "Vue d'ensemble", exact: true },
        { href: `${base}/modifier`, label: "Avant-match" },
        { href: `${base}/convocations`, label: "Convocation" },
        { href: `${base}/onze`, label: "Onze de départ" },
        { href: `${base}/delegation`, label: "Délégation" },
        { href: `${base}/direct`, label: "Pendant le match" },
        { href: `${base}/rapport`, label: "Après-match" },
      ]} />
      {children}
    </>
  );
}
