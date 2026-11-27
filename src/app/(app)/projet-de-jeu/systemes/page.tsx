import { Network } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { listSystems } from "@/lib/performance/collective-data";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GameNav } from "@/components/game/game-nav";
import { NewSystemForm, SystemsList } from "@/components/game/systems";

export const metadata = { title: "Systèmes et animations" };

export default async function SystemsPage() {
  const ctx = await requirePermission("evaluations.read");
  const systems = await listSystems(ctx);
  const manage = can(ctx, "frameworks.manage");
  return (
    <div>
      <PageHeader eyebrow="Tactique" title="Systèmes et animations"
        description="Les systèmes du club et leurs animations en possession, hors possession et en transition (par exemple 4-3-3 de référence, 3-2-5 en possession, 4-5-1 en bloc bas). Déplacez les joueuses sur le terrain."
      />
      <GameNav />
      {manage ? (
        <Card className="mb-5">
          <CardHeader><CardTitle className="text-base">Nouveau système de référence</CardTitle></CardHeader>
          <CardContent><NewSystemForm /></CardContent>
        </Card>
      ) : null}
      {systems.length === 0
        ? <EmptyState icon={Network} title="Aucun système enregistré" description={manage ? "Créez le système de référence du club à partir des systèmes proposés (4-4-2, 4-3-3, 3-5-2…)." : "Le staff n'a pas encore enregistré de système."} />
        : <SystemsList systems={systems} editable={manage} />}
    </div>
  );
}
