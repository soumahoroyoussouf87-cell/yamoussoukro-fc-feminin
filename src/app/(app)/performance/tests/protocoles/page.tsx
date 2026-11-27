import Link from "next/link";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPublishedVersion, listProtocols } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PerfNav } from "@/components/performance/perf-nav";
import { ProtocolCard } from "@/components/performance/tests";

export const metadata = { title: "Protocoles de tests" };

export default async function ProtocolsPage() {
  const ctx = await requirePermission("evaluations.read");
  const supabase = await createClient();
  const [protocols, reference, { data: used }] = await Promise.all([
    listProtocols(ctx), getPublishedVersion(ctx),
    supabase.from("technical_test_results").select("protocol_id").eq("club_id", ctx.clubId),
  ]);
  const count = new Map<string, number>();
  for (const u of used ?? []) count.set(u.protocol_id, (count.get(u.protocol_id) ?? 0) + 1);
  const criteria = (reference?.criteria ?? []).filter((c) => c.dimension === "technique").map((c) => ({ code: c.code, label: c.label }));
  const editable = can(ctx, "frameworks.manage");
  return (
    <div>
      <PageHeader eyebrow="Tests techniques" title="Protocoles"
        description="Conditions types proposées à partir du cahier des charges : adaptez-les à votre réalité. Toute modification des conditions ou du barème crée une nouvelle version, pour ne comparer que des résultats obtenus dans les mêmes conditions."
        actions={<Button asChild variant="outline"><Link href="/performance/tests">Séances de tests</Link></Button>} />
      <PerfNav />
      <ul className="grid gap-3 lg:grid-cols-2">
        {protocols.map((p) => <ProtocolCard key={p.id} p={p} criteria={criteria} editable={editable} used={count.get(p.id) ?? 0} />)}
      </ul>
    </div>
  );
}
