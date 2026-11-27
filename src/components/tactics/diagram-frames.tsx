import { buildShapes, pitchSize, type Diagram } from "@/lib/training/diagram";
import { Shapes } from "@/components/training/shape-svg";

/** Toutes les étapes d'un schéma, côte à côte (impression / PDF). */
export function DiagramFrames({ diagram, columns = 2 }: { diagram: Diagram; columns?: 1 | 2 | 3 }) {
  const { w, h } = pitchSize(diagram.pitch.kind);
  const many = diagram.frames.length > 1;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${many ? columns : 1}, minmax(0, 1fr))` }}>
      {diagram.frames.map((f, i) => (
        <figure key={f.id} className="break-inside-avoid">
          <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full rounded border" role="img" aria-label={many ? `Étape ${i + 1}` : "Schéma"}>
            <Shapes shapes={buildShapes(diagram, i)} />
          </svg>
          {many ? <figcaption className="mt-1 text-center text-xs font-semibold">Étape {i + 1}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}
