import Link from "next/link";
import { Pencil, Repeat } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { formatDate } from "@/lib/utils";
import { todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AutoForm } from "@/components/phase2/auto-form";
import { Notice } from "@/components/phase2/notice";
import { saveMacro, saveMeso } from "../actions";
import { macroFields, mesoFields } from "./fields";

export const metadata = { title: "Cycles de planification" };

export default async function CyclesPage({ searchParams }: PageProps<"/planification/cycles">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data: macros } = scope.seasonId
    ? await supabase.from("macrocycles").select("*, mesocycles(*)").eq("season_id", scope.seasonId).order("starts_on")
    : { data: [] };
  const write = can(ctx, "planning.write");
  const today = todayIso();
  const current = (s: string, e: string) => s <= today && today <= e;

  return (
    <>
      <PageHeader
        eyebrow="Planification"
        title="Macrocycles et mésocycles"
        description={`Saison ${scope.club.season?.label ?? "non définie"}. Le macrocycle couvre une grande période ; le mésocycle un bloc de 3 à 6 semaines ; le microcycle est la semaine (programme hebdomadaire).`}
        actions={<Button asChild variant="outline"><Link href="/planification/microcycles">Voir les microcycles</Link></Button>}
      />
      {sp.ok ? <Notice>Cycle enregistré.</Notice> : null}
      {!scope.seasonId ? <Notice tone="warning">Aucune saison active : définissez-la dans Administration › Paramètres.</Notice> : null}

      <section id="macro" className="flex flex-col gap-3">
        {(macros ?? []).length === 0 ? (
          <Card className="p-4"><EmptyState icon={Repeat} title="Aucun macrocycle" description="Créez la première grande période de la saison (préparation, phase aller, trêve…)." /></Card>
        ) : (
          (macros ?? []).map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">{m.name}{current(m.starts_on, m.ends_on) ? <Badge>En cours</Badge> : null}</CardTitle>
                  <CardDescription>{formatDate(m.starts_on)} → {formatDate(m.ends_on)}{m.objective ? ` · ${m.objective}` : ""}</CardDescription>
                </div>
                {write ? <Button asChild variant="ghost" size="sm"><Link href={`/planification/cycles/macro/${m.id}`} aria-label="Modifier le macrocycle"><Pencil /></Link></Button> : null}
              </CardHeader>
              <CardContent>
                {(m.mesocycles ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun mésocycle.</p>
                ) : (
                  <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {[...(m.mesocycles ?? [])].sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map((s) => (
                      <li key={s.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{s.name} {current(s.starts_on, s.ends_on) ? <Badge variant="success">En cours</Badge> : null}</p>
                          {write ? <Link href={`/planification/cycles/meso/${s.id}`} aria-label="Modifier le mésocycle" className="text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></Link> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(s.starts_on)} → {formatDate(s.ends_on)}</p>
                        {s.focus ? <p className="mt-1 text-xs"><strong>Dominante :</strong> {s.focus}</p> : null}
                        {s.objective ? <p className="mt-1 text-xs text-muted-foreground">{s.objective}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {write && scope.seasonId ? (
        <div id="meso" className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 font-display text-lg font-bold uppercase">Nouveau macrocycle</h2>
            <AutoForm action={saveMacro.bind(null, null)} fields={macroFields()} submitLabel="Créer le macrocycle" columns={2} />
          </section>
          <section>
            <h2 className="mb-2 font-display text-lg font-bold uppercase">Nouveau mésocycle</h2>
            {(macros ?? []).length ? (
              <AutoForm action={saveMeso.bind(null, null)} fields={mesoFields((macros ?? []).map((m) => ({ value: m.id, label: m.name })))} submitLabel="Créer le mésocycle" columns={2} />
            ) : (
              <p className="text-sm text-muted-foreground">Créez d&apos;abord un macrocycle.</p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
