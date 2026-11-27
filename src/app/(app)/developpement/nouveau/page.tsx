import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listPlayerOptions, listStaffOptions } from "@/lib/phase2/data";
import { SECTORS } from "@/lib/performance/collective";
import { addDays, todayISO } from "@/lib/development/util";
import { PageHeader } from "@/components/ui/page-header";
import { NewPlanForm } from "@/components/development/plan-editor";
import { SCOPES, type Scope } from "@/components/development/labels";

export const metadata = { title: "Nouveau plan de développement" };

export default async function NewPlanPage({ searchParams }: PageProps<"/developpement/nouveau">) {
  const ctx = await requirePermission("development.write");
  const sp = await searchParams;
  const scope = (SCOPES.find((s) => s === sp.portee) ?? "individuel") as Scope;
  const playerId = typeof sp.joueuse === "string" ? sp.joueuse : undefined;
  const [players, staff] = await Promise.all([listPlayerOptions(ctx), listStaffOptions(ctx)]);
  const today = todayISO();
  return (
    <div className="flex flex-col gap-3">
      <Link href="/developpement" className="text-sm font-medium text-primary underline-offset-2 hover:underline">← Plans de développement</Link>
      <PageHeader eyebrow="Développement" title="Nouveau plan" description="Choisis la portée, la personne ou le groupe concerné et la période. Les objectifs et exercices s'ajoutent ensuite." />
      <NewPlanForm scope={scope} playerId={playerId} today={today} defaultEnd={addDays(today, 56)}
        players={players.map((p) => ({ value: p.id, label: `${p.shirt ? `${p.shirt} · ` : ""}${p.name}${p.positionLabel ? ` (${p.positionLabel})` : ""}` }))}
        staff={staff.map((s) => ({ value: s.value, label: s.label }))}
        sectors={SECTORS.map((s) => ({ value: s.code, label: s.label }))} />
    </div>
  );
}
