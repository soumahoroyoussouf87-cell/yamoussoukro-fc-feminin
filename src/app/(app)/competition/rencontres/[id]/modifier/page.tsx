import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { getMatch } from "@/lib/phase2/data";
import { dayOf, timeOf } from "@/lib/phase2/labels";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveMatch } from "../../../actions";
import { matchFields } from "../../fields";
import { matchFormOptions } from "../../options";

export const metadata = { title: "Dossier d'avant-match" };

export default async function PreMatchPage({ params }: PageProps<"/competition/rencontres/[id]/modifier">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  if (!can(ctx, "matches.write")) {
    const rows: [string, string | null][] = [
      ["Rendez-vous", m.meeting_time ? `${formatDateTime(m.meeting_time)}${m.meeting_place ? ` · ${m.meeting_place}` : ""}` : null], ["Arbitre", m.referee],
      ["Objectifs", m.objectives], ["Plan de jeu", m.game_plan], ["Causerie", m.briefing], ["Logistique", m.logistics],
    ];
    return <Card><CardContent className="flex flex-col gap-3 pt-5">{rows.map(([k, v]) => <div key={k}><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="whitespace-pre-line text-sm">{v ?? "—"}</p></div>)}</CardContent></Card>;
  }
  const { opponents, competitions } = await matchFormOptions(ctx);
  const values = {
    ...m,
    match_date: dayOf(m.kickoff_at),
    match_time: timeOf(m.kickoff_at),
    meeting_time: m.meeting_time ? new Date(m.meeting_time).toISOString().slice(0, 16) : null,
  } as unknown as Record<string, string | null>;
  return <AutoForm action={saveMatch.bind(null, id)} fields={matchFields(opponents, competitions, values, true)} submitLabel="Enregistrer le dossier" cancelHref={`/competition/rencontres/${id}`} />;
}
