import Link from "next/link";
import { TeamLogo } from "@/components/phase2/team-logo";
import { Medal, Pencil, Trash2 } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { formatDate } from "@/lib/utils";
import { todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AutoForm, type FieldDef } from "@/components/phase2/auto-form";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { cn } from "@/lib/utils";
import { deleteStanding, saveStanding } from "../actions";

export const metadata = { title: "Classement" };

type V = Record<string, string | number | boolean | null | undefined>;
const fields = (v: V = {}): FieldDef[] => [
  { name: "team_name", label: "Équipe", required: true, defaultValue: v.team_name as string, span: 2 },
  { name: "is_own_team", label: "Notre équipe ?", type: "select", options: [{ value: "false", label: "Non" }, { value: "true", label: "Oui (YFC)" }], defaultValue: v.is_own_team ? "true" : "false" },
  { name: "position", label: "Rang", type: "number", required: true, min: 1, max: 40, defaultValue: v.position as number },
  { name: "played", label: "J", type: "number", required: true, min: 0, defaultValue: (v.played as number) ?? 0 },
  { name: "won", label: "V", type: "number", required: true, min: 0, defaultValue: (v.won as number) ?? 0 },
  { name: "drawn", label: "N", type: "number", required: true, min: 0, defaultValue: (v.drawn as number) ?? 0 },
  { name: "lost", label: "D", type: "number", required: true, min: 0, defaultValue: (v.lost as number) ?? 0 },
  { name: "goals_for", label: "BP", type: "number", required: true, min: 0, defaultValue: (v.goals_for as number) ?? 0 },
  { name: "goals_against", label: "BC", type: "number", required: true, min: 0, defaultValue: (v.goals_against as number) ?? 0 },
  { name: "points", label: "Pts", type: "number", required: true, defaultValue: (v.points as number) ?? 0 },
  { name: "as_of", label: "À jour au", type: "date", required: true, defaultValue: (v.as_of as string) ?? todayIso() },
];

export default async function StandingsPage({ searchParams }: PageProps<"/competition/classement">) {
  const ctx = await requirePermission("matches.read");
  const sp = await searchParams;
  const scope = await getScope(ctx);
  const comp = scope.club.competition;
  const supabase = await createClient();
  const { data } = comp ? await supabase.from("standings").select("*").eq("competition_id", comp.id).order("position") : { data: [] };
  const rows = data ?? [];
  const { data: opps } = await supabase.from("opponents").select("name, logo_path").eq("club_id", ctx.clubId);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const logos = new Map((opps ?? []).map((o) => [norm(o.name), o.logo_path]));
  const logoOf = (r: { team_name: string; is_own_team: boolean }) => (r.is_own_team ? "/brand/logo-officiel-yfc.png" : logos.get(norm(r.team_name)) ?? null);
  const write = can(ctx, "matches.write");
  const editing = typeof sp.modifier === "string" ? rows.find((r) => r.id === sp.modifier) : undefined;
  const asOf = rows.reduce<string | null>((a, r) => (!a || r.as_of > a ? r.as_of : a), null);
  return (
    <>
      <PageHeader eyebrow="Compétition" title="Classement" description={comp ? `${comp.name}${asOf ? ` · à jour au ${formatDate(asOf)}` : ""}. Classement officiel saisi par le staff (source : la ligue).` : "Aucune compétition active : définissez-la dans Administration › Paramètres."} />
      {sp.ok ? <Notice>Classement mis à jour.</Notice> : null}
      {!comp ? null : rows.length === 0 ? (
        <Card className="mb-6 p-4"><EmptyState icon={Medal} title="Classement non saisi" description="Saisissez le classement officiel équipe par équipe." /></Card>
      ) : (
        <Card className="mb-6">
          <Table>
            <THead><TR><TH>#</TH><TH>Équipe</TH><TH className="text-center">J</TH><TH className="text-center">V</TH><TH className="text-center">N</TH><TH className="text-center">D</TH><TH className="text-center">BP</TH><TH className="text-center">BC</TH><TH className="text-center">Diff.</TH><TH className="text-center">Pts</TH>{write ? <TH /> : null}</TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id} className={cn(r.is_own_team && "bg-fuchsia/10 font-semibold")}>
                  <TD className="font-display text-lg font-bold">{r.position}</TD>
                  <TD><span className="inline-flex items-center gap-2"><TeamLogo name={r.team_name} path={logoOf(r)} />{r.team_name}</span></TD>
                  {[r.played, r.won, r.drawn, r.lost, r.goals_for, r.goals_against].map((n, i) => <TD key={i} className="text-center tabular-nums">{n}</TD>)}
                  <TD className="text-center tabular-nums">{r.goals_for - r.goals_against > 0 ? "+" : ""}{r.goals_for - r.goals_against}</TD>
                  <TD className="text-center font-display text-lg font-bold tabular-nums">{r.points}</TD>
                  {write ? (
                    <TD className="whitespace-nowrap text-right">
                      <Link href={`?modifier=${r.id}#form`} aria-label={`Modifier ${r.team_name}`} className="inline-flex p-1 text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></Link>
                      <ActionButton action={deleteStanding.bind(null, r.id)} variant="ghost" confirm="Supprimer"><Trash2 className="size-4" aria-label="Supprimer" /></ActionButton>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      {comp && write ? (
        <section id="form">
          <h2 className="mb-2 font-display text-lg font-bold uppercase">{editing ? `Modifier — ${editing.team_name}` : "Ajouter une équipe"}</h2>
          <AutoForm key={editing?.id ?? "new"} action={saveStanding.bind(null, editing?.id ?? null, comp.id)} fields={fields(editing)} submitLabel={editing ? "Enregistrer" : "Ajouter"} cancelHref={editing ? "/competition/classement" : undefined} />
        </section>
      ) : null}
    </>
  );
}
