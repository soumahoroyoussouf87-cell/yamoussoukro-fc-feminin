import Link from "next/link";
import { UserCheck } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY_LABELS, REASON_LABELS, availabilityVariant } from "@/lib/data/players";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AvailabilityForm } from "@/components/players/availability-form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Disponibilité des joueuses" };

const ORDER = { indisponible: 0, restreinte: 1, incertaine: 2, disponible: 3 } as const;

export default async function AvailabilityPage() {
  const ctx = await requirePermission("availability.read");
  const supabase = await createClient();
  const [{ data }, { data: players }] = await Promise.all([
    supabase.from("player_current_availability").select("player_id, status, reason, expected_end_on, starts_on, sporting_note").eq("club_id", ctx.clubId),
    supabase.from("players").select("id, first_name, last_name").eq("club_id", ctx.clubId).is("archived_at", null),
  ]);
  const names = new Map((players ?? []).map((p) => [p.id, p]));
  const rows = (data ?? []).map((r) => ({ ...r, players: names.get(r.player_id!) })).sort((a, b) => ORDER[a.status!] - ORDER[b.status!] || (a.players?.last_name ?? "").localeCompare(b.players?.last_name ?? ""));
  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status!]: (acc[r.status!] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader eyebrow="Management" title="Disponibilité des joueuses" description="Statut sportif courant. Les informations médicales détaillées sont gérées séparément par le staff médical (Phase 5)." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(AVAILABILITY_LABELS) as (keyof typeof AVAILABILITY_LABELS)[]).map((k) => (
          <div key={k} className="rounded-xl border bg-card p-4">
            <Badge variant={availabilityVariant(k)}>{AVAILABILITY_LABELS[k]}</Badge>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{counts[k] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="p-4">
          {rows.length === 0 ? (
            <EmptyState icon={UserCheck} title="Aucune joueuse" description="Ajoutez d'abord les joueuses dans l'effectif." />
          ) : (
            <Table>
              <THead><tr><TH>Joueuse</TH><TH>Statut</TH><TH>Motif</TH><TH>Depuis</TH><TH>Retour prévu</TH></tr></THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.player_id}>
                    <TD><Link className="font-semibold hover:text-primary-text" href={`/effectif/${r.player_id}#disponibilite`}>{r.players?.first_name} {r.players?.last_name}</Link></TD>
                    <TD><Badge variant={availabilityVariant(r.status!)}>{AVAILABILITY_LABELS[r.status!]}</Badge></TD>
                    <TD className="text-muted-foreground">{r.reason ? REASON_LABELS[r.reason] : "—"}</TD>
                    <TD className="text-muted-foreground">{r.starts_on ? formatDate(r.starts_on) : "—"}</TD>
                    <TD className="text-muted-foreground">{r.expected_end_on ? formatDate(r.expected_end_on) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        {can(ctx, "availability.write") && rows.length ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Déclarer un statut</CardTitle></CardHeader>
            <CardContent>
              <AvailabilityForm players={rows.map((r) => ({ id: r.player_id!, name: `${r.players?.first_name} ${r.players?.last_name}` }))} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
