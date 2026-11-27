import Link from "next/link";
import { Flag, Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { listSetPieces } from "@/lib/tactics/set-pieces";
import { loadRoster } from "@/lib/tactics/roster";
import { buildShapes, pitchSize } from "@/lib/training/diagram";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Shapes } from "@/components/training/shape-svg";
import { NewSetPieceForm } from "@/components/tactics/set-pieces";
import { CATEGORY_LABELS, SET_PIECE_CATEGORIES, SIDE_LABELS } from "@/components/tactics/set-piece-labels";

export const metadata = { title: "Coups de pied arrêtés" };

export default async function SetPiecesPage({ searchParams }: PageProps<"/tactique/cpa">) {
  const ctx = await requirePermission("evaluations.read");
  const archived = (await searchParams).archives === "1";
  const [items, roster] = await Promise.all([listSetPieces(ctx, { archived }), loadRoster(ctx)]);
  const nameOf = new Map(roster.map((r) => [r.id, r.name]));
  const editable = can(ctx, "evaluations.write");
  const groups = SET_PIECE_CATEGORIES.map((c) => ({ c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Tactique" title="Coups de pied arrêtés"
        description="Carnet confidentiel du staff : combinaisons offensives et organisations défensives, avec schéma animé, signal, tireuses et responsabilités de chaque joueuse."
        actions={!archived && items.length ? (
          <a href="/impression/cpa" target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"><Printer className="size-4" />Imprimer le carnet</a>
        ) : null} />
      <div className="flex flex-wrap items-center gap-3">
        {editable && !archived ? <NewSetPieceForm /> : null}
        <Link href={archived ? "/tactique/cpa" : "/tactique/cpa?archives=1"} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          {archived ? "← Combinaisons en vigueur" : "Voir les combinaisons archivées"}
        </Link>
      </div>
      {groups.length === 0 ? (
        <Card className="p-4">
          <EmptyState icon={Flag} title={archived ? "Aucune combinaison archivée" : "Aucune combinaison"}
            description={archived ? "Les combinaisons archivées apparaîtront ici." : "Crée une première combinaison (corner, coup franc, penalty, touche) puis dessine-la sur le tableau."} />
        </Card>
      ) : groups.map((g) => (
        <section key={g.c} aria-label={CATEGORY_LABELS[g.c]}>
          <h2 className="mb-2 font-display text-lg font-bold uppercase">{CATEGORY_LABELS[g.c]} <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span></h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.items.map((s) => {
              const size = s.diagram ? pitchSize(s.diagram.pitch.kind) : null;
              return (
                <Link key={s.id} href={`/tactique/cpa/${s.id}`} className="group min-w-0">
                  <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
                    {s.diagram && size ? <svg viewBox={`0 0 ${size.w} ${size.h}`} className="block h-auto w-full" aria-hidden><Shapes shapes={buildShapes(s.diagram)} /></svg> : null}
                    <div className="p-3">
                      <p className="font-semibold leading-tight">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {SIDE_LABELS[s.side]}{s.signal ? ` · Signal : ${s.signal}` : ""}{s.diagram && s.diagram.frames.length > 1 ? ` · ${s.diagram.frames.length} étapes` : ""}
                      </p>
                      {s.takers.length ? <p className="mt-1 truncate text-xs">{s.takers.map((t) => nameOf.get(t) ?? "?").join(" → ")}</p> : null}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
