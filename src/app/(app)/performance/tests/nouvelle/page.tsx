import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listProtocols } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { PerfNav } from "@/components/performance/perf-nav";
import { Notice } from "@/components/phase2/notice";
import { NewTestForm } from "@/components/performance/tests";

export const metadata = { title: "Nouvelle séance de tests" };

export default async function NewTestPage() {
  const ctx = await requirePermission("evaluations.write");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [protocols, { data: sessions }] = await Promise.all([
    listProtocols(ctx, { activeOnly: true }),
    supabase.from("training_sessions").select("id, number, session_date, theme").eq("club_id", ctx.clubId).lte("session_date", today)
      .order("session_date", { ascending: false }).limit(60),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Tests techniques" title="Nouvelle séance de tests"
        description="Choisissez les protocoles réalisés et notez les conditions. Vous ajouterez ensuite les joueuses et saisirez les résultats." />
      <PerfNav />
      {protocols.length === 0 ? <Notice tone="warning">Aucun protocole actif : réactivez un protocole dans « Protocoles ».</Notice> : (
        <NewTestForm today={today} protocols={protocols}
          sessions={(sessions ?? []).map((s) => ({ id: s.id, date: s.session_date, label: `${s.session_date.split("-").reverse().join("/")} · Séance n°${s.number}${s.theme ? ` · ${s.theme}` : ""}` }))} />
      )}
    </div>
  );
}
