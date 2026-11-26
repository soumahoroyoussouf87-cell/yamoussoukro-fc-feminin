import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Journal d'activité" };

const PAGE = 50;
const TABLES: Record<string, string> = {
  players: "Joueuses", player_seasons: "Inscriptions saison", player_positions: "Postes", player_documents: "Documents",
  player_availability: "Disponibilités", staff_members: "Staff", user_roles: "Rôles utilisateurs", seasons: "Saisons",
  competitions: "Compétitions", teams: "Équipes", clubs: "Club", matches: "Matchs", opponents: "Adversaires", application_settings: "Paramètres",
};
const ACTION: Record<string, { l: string; v: "success" | "warning" | "danger" }> = {
  INSERT: { l: "Création", v: "success" }, UPDATE: { l: "Modification", v: "warning" }, DELETE: { l: "Suppression", v: "danger" },
};

function summary(row: { action: string; old_data: unknown; new_data: unknown }) {
  const n = (row.new_data ?? {}) as Record<string, unknown>;
  const o = (row.old_data ?? {}) as Record<string, unknown>;
  const label = [n.first_name ?? o.first_name, n.last_name ?? o.last_name].filter(Boolean).join(" ") || (n.label ?? n.name ?? o.label ?? o.name ?? n.title ?? o.title ?? "") as string;
  if (row.action !== "UPDATE") return label;
  const changed = Object.keys(n).filter((k) => !["updated_at"].includes(k) && JSON.stringify(n[k]) !== JSON.stringify(o[k]));
  return `${label}${label ? " — " : ""}${changed.join(", ")}`;
}

export default async function AuditPage({ searchParams }: PageProps<"/administration/journal">) {
  const ctx = await requirePermission("audit.read");
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const table = typeof sp.table === "string" && sp.table in TABLES ? sp.table : "";
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, table_name, actor_id, created_at, old_data, new_data", { count: "exact" }).eq("club_id", ctx.clubId).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (table) q = q.eq("table_name", table);
  const { data, count } = await q;
  const actors = [...new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = actors.length ? await supabase.from("profiles").select("id, full_name, email").in("id", actors) : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const last = Math.max(0, Math.ceil((count ?? 0) / PAGE) - 1);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Journal d'activité" description="Chaque création, modification et suppression est tracée automatiquement en base. Le journal n'est pas modifiable." />
      <Card className="p-4">
        <form className="mb-4 flex gap-2">
          <Select name="table" defaultValue={table} aria-label="Type de donnée" className="max-w-xs">
            <option value="">Toutes les données</option>
            {Object.entries(TABLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Filtrer</Button>
        </form>
        {!data?.length ? <EmptyState icon={ScrollText} title="Aucune activité" /> : (
          <Table>
            <THead><tr><TH>Date</TH><TH>Auteur</TH><TH>Action</TH><TH>Donnée</TH><TH>Détail</TH></tr></THead>
            <TBody>
              {data.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</TD>
                  <TD>{r.actor_id ? who.get(r.actor_id) ?? "Utilisateur" : <span className="text-muted-foreground">Système</span>}</TD>
                  <TD><Badge variant={ACTION[r.action].v}>{ACTION[r.action].l}</Badge></TD>
                  <TD>{TABLES[r.table_name] ?? r.table_name}</TD>
                  <TD className="max-w-md truncate text-muted-foreground">{summary(r)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{count ?? 0} événement(s) · page {page + 1}/{last + 1}</span>
          <div className="flex gap-2">
            {page > 0 ? <Button asChild variant="outline" size="sm"><Link href={`?table=${table}&page=${page - 1}`}>Précédent</Link></Button> : null}
            {page < last ? <Button asChild variant="outline" size="sm"><Link href={`?table=${table}&page=${page + 1}`}>Suivant</Link></Button> : null}
          </div>
        </div>
      </Card>
    </>
  );
}
