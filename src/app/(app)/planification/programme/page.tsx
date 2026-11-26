import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, ClipboardList, Copy, Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, getScope, listMatches } from "@/lib/phase2/data";
import { loadAgenda, itemTime, KIND_STYLES } from "@/lib/phase2/agenda";
import { addDays, matchDayLabel, mondayOf, weekDays } from "@/lib/domain/match-day";
import { dayOf, dayShort, INTENSITY_LABELS, todayIso, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { setWorkflowStatus } from "@/lib/phase2/workflow-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoForm } from "@/components/phase2/auto-form";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { cn } from "@/lib/utils";
import { createMicrocycle, duplicateWeek, saveMicrocycle } from "../actions";

export const metadata = { title: "Programme hebdomadaire" };

export default async function ProgrammePage({ searchParams }: PageProps<"/planification/programme">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const today = todayIso();
  const monday = mondayOf(typeof sp.semaine === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine) ? sp.semaine : today);
  const sunday = addDays(monday, 6);
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const [items, around, { data: micro }, { data: mesos }] = await Promise.all([
    loadAgenda(ctx, monday, sunday),
    listMatches(ctx, { from: addDays(monday, -2), to: addDays(sunday, 6) }),
    scope.teamId
      ? supabase.from("microcycles").select("*, mesocycles(name, focus)").eq("team_id", scope.teamId).eq("week_start", monday).maybeSingle()
      : Promise.resolve({ data: null }),
    scope.seasonId ? supabase.from("mesocycles").select("id, name, macrocycles!inner(season_id)").eq("macrocycles.season_id", scope.seasonId).order("starts_on") : Promise.resolve({ data: [] }),
  ]);
  const matchDates = around.filter((m) => m.status !== "annule" && m.status !== "reporte").map((m) => dayOf(m.kickoff_at));
  const weekMatches = matchDates.filter((d) => d >= monday && d <= sunday);
  const write = can(ctx, "planning.write");
  const validate = can(ctx, "planning.validate");
  const history = micro ? await getApprovalHistory("microcycles", micro.id) : [];
  const nav = (d: string) => `/planification/programme?semaine=${d}`;

  return (
    <>
      <PageHeader
        eyebrow="Planification"
        title="Programme hebdomadaire"
        description={`Semaine du ${dayShort(monday)} au ${dayShort(sunday)}${weekMatches.length > 1 ? ` · ${weekMatches.length} rencontres cette semaine` : ""}.`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/impression/programme?semaine=${monday}`} target="_blank"><Printer />Imprimer / PDF</Link></Button>
            {write && items.some((i) => i.kind !== "match") ? (
              <ActionButton action={duplicateWeek.bind(null, monday, addDays(monday, 7))} variant="outline" size="default"><Copy className="size-4" />Dupliquer vers la semaine suivante</ActionButton>
            ) : null}
          </>
        }
      />
      {sp.ok ? <Notice>Activité enregistrée.</Notice> : null}
      {sp.copie ? <Notice>Semaine dupliquée. Les copies sont en brouillon et devront être validées.</Notice> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon"><Link href={nav(addDays(monday, -7))} aria-label="Semaine précédente"><ChevronLeft /></Link></Button>
        <Button asChild variant="outline" size="icon"><Link href={nav(addDays(monday, 7))} aria-label="Semaine suivante"><ChevronRight /></Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href={nav(today)}>Cette semaine</Link></Button>
        {micro?.mesocycles ? <Badge variant="secondary">Mésocycle : {micro.mesocycles.name}{micro.mesocycles.focus ? ` · ${micro.mesocycles.focus}` : ""}</Badge> : null}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_minmax(0,420px)]">
        {micro ? (
          <div className="flex flex-col gap-3">
            <WorkflowBar status={micro.status} canWrite={write} canValidate={validate} onChange={setWorkflowStatus.bind(null, "microcycles", micro.id, "/planification/programme")}
              validateHint="Le programme est validé puis publié par l'entraîneur principal ou la direction sportive. La publication notifie le staff." />
            <ApprovalHistory items={history} />
          </div>
        ) : (
          <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="flex-1">Le microcycle de cette semaine n&apos;est pas encore ouvert : il porte l&apos;objectif de la semaine et son circuit de validation.</span>
            {write ? <ActionButton action={createMicrocycle.bind(null, monday)} variant="default">Ouvrir le microcycle</ActionButton> : null}
          </Card>
        )}
        {micro && write && !["valide", "publie", "archive"].includes(micro.status) ? (
          <details className="rounded-lg border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold">Objectif de la semaine</summary>
            <div className="mt-3">
              <AutoForm bare columns={1} action={saveMicrocycle.bind(null, micro.id)} submitLabel="Enregistrer"
                fields={[
                  { name: "label", label: "Libellé", defaultValue: micro.label, placeholder: "Ex. Semaine 12 — Préparation J1" },
                  { name: "mesocycle_id", label: "Mésocycle", type: "select", emptyOption: "—", options: (mesos ?? []).map((m) => ({ value: m.id, label: m.name })), defaultValue: micro.mesocycle_id },
                  { name: "objective", label: "Objectif", type: "textarea", defaultValue: micro.objective, maxLength: 1000 },
                ]} />
            </div>
          </details>
        ) : micro ? (
          <Card className="p-3 text-sm">
            <p className="font-semibold">{micro.label ?? "Objectif de la semaine"}</p>
            <p className="whitespace-pre-line text-muted-foreground">{micro.objective ?? "Non renseigné."}</p>
            <p className="mt-1 text-xs text-muted-foreground">Statut : {WORKFLOW_LABELS[micro.status]}</p>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
        {weekDays(monday).map((d) => {
          const label = matchDayLabel(d, matchDates);
          const its = items.filter((i) => i.date === d);
          return (
            <Card key={d} className={cn("flex min-h-48 flex-col p-2", d === today && "ring-2 ring-fuchsia", label === "J" && "bg-royal/10")}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold capitalize">{dayShort(d)}</span>
                <span className="font-display text-lg font-bold text-primary-text">{label ?? ""}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {its.length === 0 ? <p className="text-xs text-muted-foreground">Repos / non planifié</p> : null}
                {its.map((i) => (
                  <Link key={i.kind + i.id} href={i.href} className={cn("rounded-md border-l-4 px-2 py-1 text-xs hover:opacity-80", KIND_STYLES[i.kind])}>
                    <span className="block font-semibold">{itemTime(i)}</span>
                    <span className="block">{i.title}</span>
                    {i.subtitle ? <span className="block text-muted-foreground">{i.subtitle}</span> : null}
                    {i.intensity ? <span className="mt-0.5 block text-[10px] uppercase">Intensité {INTENSITY_LABELS[i.intensity]}</span> : null}
                    {i.status && i.kind === "seance" ? <span className="block text-[10px] text-muted-foreground">{WORKFLOW_LABELS[i.status]}</span> : null}
                  </Link>
                ))}
              </div>
              {write ? (
                <div className="mt-2 flex gap-1">
                  <Link href={`/entrainement/seances/nouvelle?date=${d}`} className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed py-1 text-[11px] text-muted-foreground hover:bg-accent" title="Ajouter une séance"><ClipboardList className="size-3" />Séance</Link>
                  <Link href={`/planification/evenements/nouveau?date=${d}`} className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed py-1 text-[11px] text-muted-foreground hover:bg-accent" title="Ajouter une activité"><CalendarPlus className="size-3" />Activité</Link>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">J = jour de match ; J-6 à J-1 = jours de préparation ; J+1 / J+2 = récupération. Une semaine à plusieurs rencontres affiche les deux références (ex. « J+1 / J-2 »).</p>
    </>
  );
}
