import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getSetPiece, listSetPieces, type SetPiece } from "@/lib/tactics/set-pieces";
import { loadRoster } from "@/lib/tactics/roster";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { DiagramFrames } from "@/components/tactics/diagram-frames";
import { H } from "@/components/reports/section-title";
import { CATEGORY_LABELS, CATEGORY_SINGULAR, SET_PIECE_CATEGORIES, SIDE_LABELS, TAKER_LABEL } from "@/components/tactics/set-piece-labels";

export const metadata = { title: "Carnet des coups de pied arrêtés" };

export default async function SetPiecePlaybook({ searchParams }: PageProps<"/impression/cpa">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await searchParams;
  const single = typeof id === "string" ? await getSetPiece(ctx, id) : null;
  if (typeof id === "string" && !single) notFound();
  const [items, roster] = await Promise.all([single ? Promise.resolve([single]) : listSetPieces(ctx), loadRoster(ctx)]);
  const who = new Map(roster.map((r) => [r.id, `${r.number ? `${r.number} · ` : ""}${r.name}`]));
  const groups = SET_PIECE_CATEGORIES.map((c) => ({ c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length);
  return (
    <>
      <PrintToolbar filename={single ? `cpa-${single.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}` : "carnet-cpa"} />
      <div id="document" className="print-sheet">
        <DocHeader title={single ? single.name : "Carnet des coups de pied arrêtés"}
          subtitle={single ? CATEGORY_SINGULAR[single.category] : `${items.length} combinaison${items.length > 1 ? "s" : ""} en vigueur`} reference="Confidentiel staff" />
        {!items.length ? <p className="text-sm">Aucune combinaison en vigueur.</p> : groups.map((g) => (
          <section key={g.c}>
            {!single ? <H>{CATEGORY_LABELS[g.c]}</H> : null}
            {g.items.map((s) => <Routine key={s.id} s={s} who={who} showTitle={!single} />)}
          </section>
        ))}
        <DocFooter note="Document confidentiel — staff technique du Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}

function Routine({ s, who, showTitle }: { s: SetPiece; who: Map<string, string>; showTitle: boolean }) {
  return (
    <article className="mb-5 break-inside-avoid border-b pb-4 last:border-b-0">
      {showTitle ? <h3 className="mb-1 text-base font-bold uppercase">{s.name}</h3> : null}
      <p className="mb-2 text-sm"><strong>Côté :</strong> {SIDE_LABELS[s.side]}{s.signal ? <> · <strong>Signal :</strong> {s.signal}</> : null}</p>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">{s.diagram ? <DiagramFrames diagram={s.diagram} columns={2} /> : <p className="text-sm">Pas de schéma.</p>}</div>
        <div className="col-span-2 space-y-2 text-sm">
          <div>
            <p className="font-bold">{TAKER_LABEL(s.category)}</p>
            {s.takers.length ? <ol className="list-decimal pl-5">{s.takers.map((t) => <li key={t}>{who.get(t) ?? "Joueuse retirée"}</li>)}</ol> : <p>—</p>}
          </div>
          <div>
            <p className="font-bold">Responsabilités</p>
            {s.responsibilities.length ? (
              <ul className="space-y-0.5">{s.responsibilities.map((r, i) => <li key={i}><strong>{r.player_id ? who.get(r.player_id) ?? "Joueuse retirée" : "À définir"}</strong> : {r.role}</li>)}</ul>
            ) : <p>—</p>}
          </div>
        </div>
      </div>
      {s.instructions ? <div className="mt-2 text-sm"><p className="font-bold">Consignes</p><p className="whitespace-pre-line">{s.instructions}</p></div> : null}
      {s.notes ? <div className="mt-1 text-sm"><p className="font-bold">Remarques</p><p className="whitespace-pre-line">{s.notes}</p></div> : null}
    </article>
  );
}
