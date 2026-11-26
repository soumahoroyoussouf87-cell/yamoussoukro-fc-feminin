import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listPlayerOptions } from "@/lib/phase2/data";
import { ATTENDANCE_LABELS, dayShort, todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Présences" };

export default async function AttendanceOverviewPage() {
  const ctx = await requirePermission("planning.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, number, session_date, theme, training_attendance(player_id, status)")
    .eq("club_id", ctx.clubId)
    .eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000")
    .lte("session_date", todayIso())
    .order("session_date", { ascending: false });
  const players = await listPlayerOptions(ctx);
  const recorded = (sessions ?? []).filter((s) => (s.training_attendance ?? []).length > 0);
  const stats = new Map<string, Record<string, number>>();
  for (const s of recorded) for (const a of s.training_attendance ?? []) {
    const r = stats.get(a.player_id) ?? {};
    r[a.status] = (r[a.status] ?? 0) + 1;
    stats.set(a.player_id, r);
  }
  const keys = Object.keys(ATTENDANCE_LABELS);
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Présences" description={`Bilan sur ${recorded.length} séance(s) dont les présences ont été saisies cette saison. Le taux compte « présente » et « en retard ».`} />
      {recorded.length === 0 ? (
        <Card className="p-4"><EmptyState icon={ListChecks} title="Aucune présence saisie" description="Saisissez les présences depuis chaque fiche de séance." /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Card>
            <Table>
              <THead><TR><TH>Joueuse</TH>{keys.map((k) => <TH key={k} className="text-center">{ATTENDANCE_LABELS[k]}</TH>)}<TH className="text-center">Taux</TH></TR></THead>
              <TBody>
                {players.map((p) => {
                  const r = stats.get(p.id) ?? {};
                  const total = keys.reduce((a, k) => a + (r[k] ?? 0), 0);
                  const rate = total ? Math.round((((r.present ?? 0) + (r.retard ?? 0)) / total) * 100) : null;
                  return (
                    <TR key={p.id}>
                      <TD className="font-semibold">{p.name}</TD>
                      {keys.map((k) => <TD key={k} className="text-center tabular-nums">{r[k] ?? ""}</TD>)}
                      <TD className="text-center font-semibold tabular-nums">{rate == null ? "—" : `${rate} %`}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Dernières séances</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {(sessions ?? []).slice(0, 15).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <Link href={`/entrainement/seances/${s.id}/presences`} className="truncate hover:underline">n°{s.number} · {dayShort(s.session_date)} · {s.theme}</Link>
                    <span className="text-xs text-muted-foreground">{(s.training_attendance ?? []).length ? `${(s.training_attendance ?? []).length} saisies` : "à saisir"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
