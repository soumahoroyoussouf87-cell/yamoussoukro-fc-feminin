import Link from "next/link";
import { PenTool, Plus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildShapes, parseDiagram, pitchSize } from "@/lib/training/diagram";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Shapes } from "@/components/training/shape-svg";

export const metadata = { title: "Schémas tactiques" };

export default async function DiagramsPage() {
  const ctx = await requirePermission("planning.read");
  const supabase = await createClient();
  const { data } = await supabase.from("tactical_diagrams").select("id, title, data, updated_at").eq("club_id", ctx.clubId).is("archived_at", null).order("updated_at", { ascending: false }).limit(120);
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Schémas tactiques" description="Tous les schémas restent modifiables. Ceux dessinés depuis une fiche ou un exercice apparaissent ici."
        actions={can(ctx, "planning.write") ? <Button asChild><Link href="/entrainement/schemas/nouveau"><Plus />Nouveau schéma</Link></Button> : null} />
      {(data ?? []).length === 0 ? <Card className="p-4"><EmptyState icon={PenTool} title="Aucun schéma" description="Dessine un schéma depuis l'étape 4 d'une fiche de séance ou crée-le ici." /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((d) => {
            const parsed = parseDiagram(d.data);
            const size = parsed ? pitchSize(parsed.pitch.kind) : null;
            return (
              <Link key={d.id} href={`/entrainement/schemas/${d.id}`} className="group">
                <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
                  {parsed && size ? <svg viewBox={`0 0 ${size.w} ${size.h}`} className="block h-auto w-full" aria-hidden><Shapes shapes={buildShapes(parsed)} /></svg> : null}
                  <div className="p-3">
                    <p className="font-semibold leading-tight">{d.title}</p>
                    <p className="text-xs text-muted-foreground">Modifié le {formatDateTime(d.updated_at)}{parsed && parsed.frames.length > 1 ? ` · ${parsed.frames.length} étapes` : ""}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
