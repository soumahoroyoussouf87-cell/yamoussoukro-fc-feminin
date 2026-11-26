import Link from "next/link";
import { Trophy } from "lucide-react";
import type { AccessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches } from "@/lib/phase2/data";
import { dayOf, dayShort, LINEUP_STATUS_LABELS, timeOf, todayIso, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type Module = "convocations" | "onze" | "delegation";
const TITLES: Record<Module, [string, string]> = {
  convocations: ["Convocations", "Listes de joueuses convoquées par rencontre (18 par défaut, configurable). Publication = notification aux convoquées."],
  onze: ["Onze de départ", "Compositions par rencontre. Les compositions provisoires restent confidentielles jusqu'à leur communication."],
  delegation: ["Délégations", "Délégations officielles par rencontre : membres, transport, hébergement, budget, document signé."],
};

/** Liste des rencontres avec l'état d'un module (convocation, onze ou délégation). */
export async function ModuleIndex({ ctx, module }: { ctx: AccessContext; module: Module }) {
  const scope = await getScope(ctx);
  const matches = await listMatches(ctx, { seasonId: scope.seasonId ?? "00000000-0000-0000-0000-000000000000" });
  const today = todayIso();
  const upcoming = matches.filter((m) => dayOf(m.kickoff_at) >= today);
  const past = matches.filter((m) => dayOf(m.kickoff_at) < today).reverse().slice(0, 10);
  const ids = matches.map((m) => m.id);
  const supabase = await createClient();
  const state = new Map<string, React.ReactNode>();
  if (ids.length) {
    if (module === "convocations") {
      const { data } = await supabase.from("match_squads").select("match_id, status, size_limit, match_squad_players(status)").in("match_id", ids);
      for (const s of data ?? []) state.set(s.match_id, <><Badge variant={workflowVariant(s.status)}>{WORKFLOW_LABELS[s.status]}</Badge> <span className="text-xs">{(s.match_squad_players ?? []).filter((p) => p.status === "convoquee").length}/{s.size_limit}</span></>);
    } else if (module === "onze") {
      const { data } = await supabase.from("lineups").select("match_id, status").in("match_id", ids);
      for (const id of ids) {
        const l = (data ?? []).filter((x) => x.match_id === id);
        if (!l.length) continue;
        const off = l.find((x) => x.status !== "provisoire");
        state.set(id, off ? <Badge variant="success">{LINEUP_STATUS_LABELS[off.status]}</Badge> : <Badge variant="warning">{l.length} provisoire(s)</Badge>);
      }
    } else {
      const { data } = await supabase.from("delegations").select("match_id, status, delegation_members(id)").in("match_id", ids);
      for (const d of data ?? []) state.set(d.match_id, <><Badge variant={workflowVariant(d.status)}>{WORKFLOW_LABELS[d.status]}</Badge> <span className="text-xs">{(d.delegation_members ?? []).length} membre(s)</span></>);
    }
  }
  const sub = module === "convocations" ? "convocations" : module === "onze" ? "onze" : "delegation";
  const table = (rows: typeof matches) => (
    <Card>
      <Table>
        <THead><TR><TH>Date</TH><TH>Rencontre</TH><TH>État</TH></TR></THead>
        <TBody>
          {rows.map((m) => (
            <TR key={m.id}>
              <TD className="whitespace-nowrap capitalize">{dayShort(dayOf(m.kickoff_at))} · {timeOf(m.kickoff_at)}</TD>
              <TD><Link href={`/competition/rencontres/${m.id}/${sub}`} className="font-semibold hover:underline">{m.opponent}</Link>{m.matchday ? <span className="ml-2 text-xs text-muted-foreground">{m.matchday}</span> : null}</TD>
              <TD>{state.get(m.id) ?? <span className="text-xs text-muted-foreground">Non créé</span>}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
  return (
    <>
      <PageHeader eyebrow="Compétition" title={TITLES[module][0]} description={TITLES[module][1]} />
      {matches.length === 0 ? (
        <Card className="p-4"><EmptyState icon={Trophy} title="Aucune rencontre" description="Créez d'abord les rencontres dans le calendrier des rencontres." /></Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section><h2 className="mb-2 font-display text-lg font-bold uppercase">À venir</h2>{upcoming.length ? table(upcoming) : <p className="text-sm text-muted-foreground">Aucune rencontre à venir.</p>}</section>
          {past.length ? <section><h2 className="mb-2 font-display text-lg font-bold uppercase">Passées</h2>{table(past)}</section> : null}
        </div>
      )}
    </>
  );
}
