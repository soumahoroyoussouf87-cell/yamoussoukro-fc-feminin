import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions } from "@/lib/phase2/data";
import { scoreFromEvents } from "@/lib/domain/player-stats";
import { MATCH_EVENT_LABELS, PERIOD_LABELS } from "@/lib/phase2/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoForm } from "@/components/phase2/auto-form";
import { ActionButton } from "@/components/phase2/action-button";
import { addMatchEvent, applyEventScore, deleteMatchEvent } from "../../../actions";

export const metadata = { title: "Pendant le match" };

const PERIOD_ORDER = ["1MT", "2MT", "PROL1", "PROL2", "TAB"];
const TONE: Record<string, "success" | "danger" | "warning" | "secondary" | "outline"> = {
  but: "success", csc_pour: "success", but_adverse: "danger", csc_contre: "danger", carton_jaune: "warning", carton_rouge: "danger", remplacement: "secondary",
};

export default async function LivePage({ params }: PageProps<"/competition/rencontres/[id]/direct">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const [{ data: events }, { data: squad }, players] = await Promise.all([
    supabase.from("match_events").select("*").eq("match_id", id),
    supabase.from("match_squads").select("match_squad_players(player_id, status)").eq("match_id", id).maybeSingle(),
    listPlayerOptions(ctx),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const convoked = new Set((squad?.match_squad_players ?? []).filter((p) => p.status === "convoquee").map((p) => p.player_id));
  const options = (convoked.size ? players.filter((p) => convoked.has(p.id)) : players).map((p) => ({ value: p.id, label: `${p.shirt ?? ""} ${p.name}`.trim() }));
  const list = [...(events ?? [])].sort((a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period) || a.minute - b.minute || (a.added_minute ?? 0) - (b.added_minute ?? 0));
  const sc = scoreFromEvents(list);
  const write = can(ctx, "matches.write");
  const mismatch = m.status === "joue" && (m.goals_for !== sc.us || m.goals_against !== sc.them) && list.length > 0;
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Chronologie</CardTitle>
          <p className="font-display text-2xl font-bold tabular-nums" title="Score reconstitué à partir des événements">YFC {sc.us} – {sc.them}</p>
        </CardHeader>
        <CardContent>
          {mismatch ? <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">Le score enregistré ({m.goals_for}-{m.goals_against}) diffère des événements ({sc.us}-{sc.them}).</p> : null}
          {list.length === 0 ? <p className="text-sm text-muted-foreground">Aucun événement saisi.</p> : (
            <ol className="flex flex-col gap-1">
              {list.map((e) => {
                const p = e.player_id ? byId.get(e.player_id) : null;
                const r = e.related_player_id ? byId.get(e.related_player_id) : null;
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-md border p-2 text-sm">
                    <span className="w-16 shrink-0 font-display text-lg font-bold tabular-nums">{e.minute}&apos;{e.added_minute ? `+${e.added_minute}` : ""}</span>
                    <div className="flex-1">
                      <Badge variant={TONE[e.type] ?? "outline"}>{MATCH_EVENT_LABELS[e.type]}</Badge> <span className="text-xs text-muted-foreground">{PERIOD_LABELS[e.period]}</span>
                      <p>
                        {e.type === "remplacement" ? <>Sortie : {p?.name ?? "?"} · Entrée : {r?.name ?? "?"}</> : <>{p?.name ?? ""}{e.type === "but" && r ? <span className="text-muted-foreground"> (passe : {r.name})</span> : null}</>}
                      </p>
                      {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
                    </div>
                    {write ? <ActionButton action={deleteMatchEvent.bind(null, id, e.id)} variant="ghost" confirm="Supprimer"><Trash2 className="size-4" aria-label="Supprimer" /></ActionButton> : null}
                  </li>
                );
              })}
            </ol>
          )}
          {write && list.length > 0 && (m.status !== "joue" || mismatch) ? (
            <div className="mt-3"><ActionButton action={applyEventScore.bind(null, id, sc.us, sc.them)} variant="secondary">Enregistrer le score final {sc.us}-{sc.them} (match joué)</ActionButton></div>
          ) : null}
        </CardContent>
      </Card>
      {write ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Ajouter un événement</CardTitle></CardHeader>
          <CardContent>
            <AutoForm bare columns={2} action={addMatchEvent.bind(null, id)} submitLabel="Ajouter"
              fields={[
                { name: "type", label: "Événement", type: "select", required: true, span: 2, options: Object.entries(MATCH_EVENT_LABELS).map(([value, label]) => ({ value, label })), defaultValue: "but" },
                { name: "period", label: "Période", type: "select", required: true, options: Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label })), defaultValue: "1MT" },
                { name: "minute", label: "Minute", type: "number", required: true, min: 0, max: 130 },
                { name: "added_minute", label: "Temps additionnel", type: "number", min: 1, max: 30 },
                { name: "player_id", label: "Joueuse (buteuse, avertie, sortante…)", type: "select", span: 2, emptyOption: "—", options },
                { name: "related_player_id", label: "Passeuse décisive / joueuse entrante", type: "select", span: 2, emptyOption: "—", options },
                { name: "note", label: "Observation", type: "textarea", span: 2, maxLength: 500, rows: 2 },
              ]} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
