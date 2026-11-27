import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { getSetPiece } from "@/lib/tactics/set-pieces";
import { loadRoster } from "@/lib/tactics/roster";
import { PageHeader } from "@/components/ui/page-header";
import { SetPieceEditor } from "@/components/tactics/set-pieces";
import { CATEGORY_SINGULAR } from "@/components/tactics/set-piece-labels";

export const metadata = { title: "Coup de pied arrêté" };

export default async function SetPiecePage({ params }: PageProps<"/tactique/cpa/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const [sp, roster] = await Promise.all([getSetPiece(ctx, id), loadRoster(ctx)]);
  if (!sp) notFound();
  return (
    <div className="flex flex-col gap-3">
      <Link href="/tactique/cpa" className="text-sm font-medium text-primary underline-offset-2 hover:underline">← Coups de pied arrêtés</Link>
      <PageHeader eyebrow={CATEGORY_SINGULAR[sp.category]} title={sp.name} description={sp.archived ? "Combinaison archivée." : undefined} />
      <SetPieceEditor key={sp.id} sp={sp} roster={roster} editable={can(ctx, "evaluations.write")} />
    </div>
  );
}
