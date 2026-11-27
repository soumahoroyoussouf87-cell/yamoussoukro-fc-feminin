import Link from "next/link";
import { Swords } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TeamLogo } from "@/components/phase2/team-logo";
import { resultOf } from "@/lib/tactics/data";

export const metadata = { title: "Analyse des adversaires" };

export default async function OpponentsPage() {
  const ctx = await requirePermission("evaluations.read");
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: opps }, { data: matches }, { data: notes }] = await Promise.all([
    supabase.from("opponents").select("id, name, logo_path").eq("club_id", ctx.clubId).order("name"),
    supabase.from("matches").select("opponent_id, kickoff_at, status, goals_for, goals_against").eq("club_id", ctx.clubId).order("kickoff_at"),
    supabase.from("opponent_scouting").select("opponent_id, observed_on").eq("club_id", ctx.clubId),
  ]);
  const rows = (opps ?? []).map((o) => {
    const ms = (matches ?? []).filter((m) => m.opponent_id === o.id);
    const played = ms.map(resultOf).filter(Boolean) as string[];
    const next = ms.find((m) => m.kickoff_at >= now && m.status === "programme");
    const ns = (notes ?? []).filter((n) => n.opponent_id === o.id).map((n) => n.observed_on).sort();
    return { ...o, record: { V: played.filter((x) => x === "V").length, N: played.filter((x) => x === "N").length, D: played.filter((x) => x === "D").length }, next: next?.kickoff_at.slice(0, 10) ?? null, notes: ns.length, last: ns.at(-1) ?? null };
  }).sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999") || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader eyebrow="Tactique" title="Analyse des adversaires"
        description="Fiches d'observation confidentielles, réservées au staff technique : faits observés d'un côté, lecture du staff et plan de jeu de l'autre. Les prochains adversaires apparaissent en premier." />
      {rows.length === 0 ? <EmptyState icon={Swords} title="Aucun adversaire" description="Les adversaires sont créés avec les rencontres." /> : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <THead><TR><TH>Adversaire</TH><TH>Prochain match</TH><TH className="text-center">V-N-D</TH><TH className="text-center">Fiches</TH><TH>Dernière observation</TH></TR></THead>
            <TBody>
              {rows.map((o) => (
                <TR key={o.id}>
                  <TD><Link href={`/tactique/adversaires/${o.id}`} className="inline-flex items-center gap-2 font-semibold hover:underline"><TeamLogo name={o.name} path={o.logo_path} />{o.name}</Link></TD>
                  <TD className="whitespace-nowrap">{o.next ? o.next.split("-").reverse().join("/") : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-center tabular-nums">{o.record.V}-{o.record.N}-{o.record.D}</TD>
                  <TD className="text-center tabular-nums">{o.notes}</TD>
                  <TD className="whitespace-nowrap">{o.last ? o.last.split("-").reverse().join("/") : <span className="text-xs text-muted-foreground">Jamais observé</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
