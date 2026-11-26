import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { dayShort, INTENSITY_LABELS, todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Évaluation des séances" };

export default async function SessionEvaluationsPage() {
  const ctx = await requirePermission("planning.read");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_sessions")
    .select("id, number, session_date, theme, intensity, session_evaluations(objectives_reached, engagement, intensity_observed, actual_duration_min, strengths, improvements)")
    .eq("club_id", ctx.clubId)
    .eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000")
    .lte("session_date", todayIso())
    .order("session_date", { ascending: false })
    .limit(60);
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null;
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Évaluation des séances" description="Retour du staff après chaque séance : objectifs atteints, engagement, intensité réelle." />
      {(data ?? []).length === 0 ? (
        <Card className="p-4"><EmptyState icon={ClipboardCheck} title="Aucune séance passée" /></Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Séance</TH><TH>Objectifs</TH><TH>Engagement</TH><TH>Intensité prévue → observée</TH><TH>Durée réelle</TH><TH>À améliorer</TH></TR></THead>
            <TBody>
              {(data ?? []).map((s) => {
                const e = one(s.session_evaluations);
                return (
                  <TR key={s.id}>
                    <TD><Link className="font-semibold hover:underline" href={`/entrainement/seances/${s.id}`}>n°{s.number} · {dayShort(s.session_date)}</Link><span className="block text-xs text-muted-foreground">{s.theme}</span></TD>
                    {e ? (
                      <>
                        <TD>{e.objectives_reached ?? "—"}/5</TD>
                        <TD>{e.engagement ?? "—"}/5</TD>
                        <TD className="text-xs">{s.intensity ? INTENSITY_LABELS[s.intensity] : "—"} → {e.intensity_observed ? INTENSITY_LABELS[e.intensity_observed] : "—"}</TD>
                        <TD>{e.actual_duration_min ? `${e.actual_duration_min} min` : "—"}</TD>
                        <TD className="max-w-xs truncate text-xs">{e.improvements ?? ""}</TD>
                      </>
                    ) : <TD colSpan={5} className="text-xs text-muted-foreground">Non évaluée</TD>}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
