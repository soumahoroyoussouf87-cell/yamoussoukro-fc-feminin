import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDiagram } from "@/lib/training/diagram";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { DiagramFrames } from "@/components/tactics/diagram-frames";

export const metadata = { title: "Schéma tactique" };

export default async function PrintDiagram({ params }: PageProps<"/impression/schema/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("tactical_diagrams").select("id, title, data, updated_at").eq("id", id).eq("club_id", ctx.clubId).maybeSingle();
  const parsed = d ? parseDiagram(d.data) : null;
  if (!d || !parsed) notFound();
  const n = parsed.frames.length;
  return (
    <>
      <PrintToolbar filename={`schema-${d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`} />
      <div id="document" className="print-sheet">
        <DocHeader title={d.title} subtitle={n > 1 ? `Schéma tactique · ${n} étapes` : "Schéma tactique"} reference="Confidentiel staff" />
        <DiagramFrames diagram={parsed} columns={n > 4 ? 3 : 2} />
        <DocFooter />
      </div>
    </>
  );
}
