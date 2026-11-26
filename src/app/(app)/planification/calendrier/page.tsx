import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { loadAgenda, itemTime, KIND_STYLES, type AgendaItem } from "@/lib/phase2/agenda";
import { listMatches } from "@/lib/phase2/data";
import { addDays, matchDayLabel, mondayOf, weekDays } from "@/lib/domain/match-day";
import { dayLong, dayOf, dayShort, monthLabel, todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendrier de la saison" };

const VIEWS = { jour: "Jour", semaine: "Semaine", mois: "Mois", annee: "Année" } as const;
type View = keyof typeof VIEWS;
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: string, n: number) => {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};
const lastOfMonth = (iso: string) => addDays(addMonths(firstOfMonth(iso), 1), -1);

function range(view: View, date: string): [string, string] {
  if (view === "jour") return [date, date];
  if (view === "semaine") return [mondayOf(date), addDays(mondayOf(date), 6)];
  if (view === "mois") return [mondayOf(firstOfMonth(date)), addDays(mondayOf(lastOfMonth(date)), 6)];
  return [`${date.slice(0, 4)}-01-01`, `${date.slice(0, 4)}-12-31`];
}
function step(view: View, date: string, dir: number) {
  if (view === "jour") return addDays(date, dir);
  if (view === "semaine") return addDays(date, 7 * dir);
  if (view === "mois") return addMonths(date, dir);
  return `${+date.slice(0, 4) + dir}-01-01`;
}

function Item({ i, compact = false }: { i: AgendaItem; compact?: boolean }) {
  return (
    <Link href={i.href} className={cn("block rounded-md border-l-4 px-2 py-1 text-xs hover:opacity-80", KIND_STYLES[i.kind])} title={i.title}>
      <span className="font-semibold">{itemTime(i)} </span>
      <span className={compact ? "line-clamp-1" : ""}>{i.title}</span>
      {!compact && i.subtitle ? <span className="block text-muted-foreground">{i.subtitle}</span> : null}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/planification/calendrier">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const view: View = (Object.keys(VIEWS) as View[]).includes(sp.vue as View) ? (sp.vue as View) : "semaine";
  const today = todayIso();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const [from, to] = range(view, date);
  const [items, matchesAround] = await Promise.all([
    loadAgenda(ctx, from, to),
    listMatches(ctx, { from: addDays(from, -2), to: addDays(to, 7) }),
  ]);
  const matchDates = matchesAround.filter((m) => m.status !== "annule" && m.status !== "reporte").map((m) => dayOf(m.kickoff_at));
  const byDay = new Map<string, AgendaItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  const href = (v: View, d: string) => `/planification/calendrier?vue=${v}&date=${d}`;
  const title =
    view === "jour" ? dayLong(date) : view === "semaine" ? `Semaine du ${dayShort(from)} au ${dayShort(to)}` : view === "mois" ? monthLabel(date) : date.slice(0, 4);
  const write = can(ctx, "planning.write");

  return (
    <>
      <PageHeader
        eyebrow="Planification"
        title="Calendrier"
        description="Séances, rencontres et activités du staff réunies au même endroit. Les références J-6 à J+1 sont calculées à partir des rencontres."
        actions={write ? (
          <>
            <Button asChild variant="outline"><Link href={`/planification/evenements/nouveau?date=${date}`}><CalendarPlus />Ajouter une activité</Link></Button>
            <Button asChild><Link href={`/entrainement/seances/nouvelle?date=${date}`}><ClipboardList />Créer une séance</Link></Button>
          </>
        ) : null}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Vue">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link key={v} href={href(v, date)} aria-current={v === view ? "page" : undefined}
              className={cn("rounded px-3 py-1.5 text-sm", v === view ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent")}>
              {VIEWS[v]}
            </Link>
          ))}
        </div>
        <Button asChild variant="outline" size="icon"><Link href={href(view, step(view, date, -1))} aria-label="Période précédente"><ChevronLeft /></Link></Button>
        <Button asChild variant="outline" size="icon"><Link href={href(view, step(view, date, 1))} aria-label="Période suivante"><ChevronRight /></Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href={href(view, today)}>Aujourd&apos;hui</Link></Button>
        <h2 className="ml-2 font-display text-xl font-bold capitalize">{title}</h2>
        <span className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-fuchsia" />Séance</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-royal" />Match</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted-foreground" />Activité</span>
        </span>
      </div>

      {view === "jour" ? (
        <Card className="p-4">
          {matchDayLabel(date, matchDates) ? <p className="mb-3 font-display text-lg font-bold text-primary-text">{matchDayLabel(date, matchDates)}</p> : null}
          {(byDay.get(date) ?? []).length ? (
            <div className="flex flex-col gap-2">{(byDay.get(date) ?? []).map((i) => <Item key={i.kind + i.id} i={i} />)}</div>
          ) : (
            <EmptyState icon={CalendarPlus} title="Rien de planifié ce jour" />
          )}
        </Card>
      ) : null}

      {view === "semaine" ? (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays(from).map((d) => (
            <Card key={d} className={cn("min-h-40 p-2", d === today && "ring-2 ring-fuchsia")}>
              <Link href={href("jour", d)} className="mb-2 flex items-baseline justify-between gap-1 text-xs hover:underline">
                <span className="font-semibold capitalize">{dayShort(d)}</span>
                {matchDayLabel(d, matchDates) ? <span className="font-display font-bold text-primary-text">{matchDayLabel(d, matchDates)}</span> : null}
              </Link>
              <div className="flex flex-col gap-1">{(byDay.get(d) ?? []).map((i) => <Item key={i.kind + i.id} i={i} />)}</div>
            </Card>
          ))}
        </div>
      ) : null}

      {view === "mois" ? (
        <Card className="overflow-x-auto p-2">
          <div className="grid min-w-[720px] grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => <div key={w} className="px-1 text-xs font-semibold uppercase text-muted-foreground">{w}</div>)}
            {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 }, (_, k) => addDays(from, k)).map((d) => (
              <div key={d} className={cn("min-h-24 rounded border p-1", d.slice(0, 7) !== date.slice(0, 7) && "opacity-40", d === today && "ring-2 ring-fuchsia")}>
                <Link href={href("jour", d)} className="flex justify-between text-[11px] hover:underline">
                  <span className="font-semibold">{+d.slice(8)}</span>
                  <span className="font-bold text-primary-text">{matchDayLabel(d, matchDates) ?? ""}</span>
                </Link>
                <div className="mt-1 flex flex-col gap-0.5">{(byDay.get(d) ?? []).slice(0, 3).map((i) => <Item key={i.kind + i.id} i={i} compact />)}</div>
                {(byDay.get(d) ?? []).length > 3 ? <Link href={href("jour", d)} className="text-[10px] text-muted-foreground">+{(byDay.get(d) ?? []).length - 3}</Link> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {view === "annee" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => `${date.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`).map((first) => {
            const start = mondayOf(first);
            const days = Array.from({ length: 42 }, (_, k) => addDays(start, k));
            const inMonth = items.filter((i) => i.date.slice(0, 7) === first.slice(0, 7));
            return (
              <Card key={first} className="p-3">
                <Link href={href("mois", first)} className="font-display font-bold capitalize hover:underline">{monthLabel(first)}</Link>
                <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px]">
                  {WEEKDAYS.map((w) => <span key={w} className="text-muted-foreground">{w[0]}</span>)}
                  {days.map((d) => {
                    const its = byDay.get(d) ?? [];
                    const kind = its.some((i) => i.kind === "match") ? "bg-royal text-white" : its.some((i) => i.kind === "seance") ? "bg-fuchsia/70 text-white" : its.length ? "bg-muted" : "";
                    return d.slice(0, 7) === first.slice(0, 7) ? (
                      <Link key={d} href={href("jour", d)} className={cn("rounded py-0.5", kind, d === today && "ring-1 ring-fuchsia")}>{+d.slice(8)}</Link>
                    ) : <span key={d} />;
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {inMonth.filter((i) => i.kind === "seance").length} séance(s) · {inMonth.filter((i) => i.kind === "match").length} match(s) · {inMonth.filter((i) => i.kind === "evenement").length} activité(s)
                </p>
              </Card>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
