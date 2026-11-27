import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { dayShort, hm, INTENSITY_LABELS, todayIso, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Fiches de séance" };

export default async function SessionsPage({ searchParams }: PageProps<"/entrainement/seances">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const scope = await getScope(ctx);
  const past = sp.passees === "1";
  const today = todayIso();
  const supabase = await createClient();
  let q = supabase
    .from("training_sessions")
    .select("id, number, session_date, starts_at, ends_at, theme, sub_theme, intensity, status, location, session_exercises(duration_min), training_attendance(status)")
    .eq("club_id", ctx.clubId)
    .eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000");
  q = past ? q.lt("session_date", today).order("session_date", { ascending: false }) : q.gte("session_date", today).order("session_date");
  const { data } = await q.order("starts_at").limit(100);
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Fiches de séance" description="Numérotation automatique par saison. Chaque séance suit le circuit Brouillon → Soumis → Validé → Publié → Archivé."
        actions={can(ctx, "planning.write") ? <Button asChild><Link href="/entrainement/seances/nouvelle"><Plus />Créer une séance</Link></Button> : null} />
      <div className="mb-3 flex gap-2">
        <Button asChild variant={past ? "ghost" : "secondary"} size="sm"><Link href="/entrainement/seances">À venir</Link></Button>
        <Button asChild variant={past ? "secondary" : "ghost"} size="sm"><Link href="/entrainement/seances?passees=1">Passées</Link></Button>
      </div>
      {(data ?? []).length === 0 ? (
        <Card className="p-4"><EmptyState icon={ClipboardList} title={past ? "Aucune séance passée" : "Aucune séance à venir"} description="Créez une séance ou planifiez la semaine depuis le programme hebdomadaire." /></Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>N°</TH><TH>Date</TH><TH>Thème</TH><TH>Intensité</TH><TH>Contenu</TH><TH>Présences</TH><TH>Statut</TH></TR></THead>
            <TBody>
              {(data ?? []).map((s) => {
                const dur = (s.session_exercises ?? []).reduce((a, e) => a + (e.duration_min ?? 0), 0);
                const present = (s.training_attendance ?? []).filter((a) => a.status === "present" || a.status === "retard").length;
                return (
                  <TR key={s.id} className={cn(s.session_date === today && "bg-fuchsia/5")}>
                    <TD className="font-display font-bold">{s.number}</TD>
                    <TD className="whitespace-nowrap capitalize">{dayShort(s.session_date)} {s.starts_at ? `· ${hm(s.starts_at)}` : ""}</TD>
                    <TD><Link href={`/entrainement/seances/${s.id}`} className="font-semibold hover:underline">{s.theme ?? "Séance sans thème"}</Link>{s.sub_theme ? <span className="block text-xs text-muted-foreground">{s.sub_theme}</span> : null}</TD>
                    <TD>{s.intensity ? INTENSITY_LABELS[s.intensity] : "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{(s.session_exercises ?? []).length} exercice(s){dur ? ` · ${dur} min` : ""}</TD>
                    <TD className="text-xs">{(s.training_attendance ?? []).length ? `${present}/${(s.training_attendance ?? []).length}` : "—"}</TD>
                    <TD><Badge variant={workflowVariant(s.status)}>{WORKFLOW_LABELS[s.status]}</Badge></TD>
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
