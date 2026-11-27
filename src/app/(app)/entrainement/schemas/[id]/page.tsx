import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDiagram } from "@/lib/training/diagram";
import { PageHeader } from "@/components/ui/page-header";
import { loadRoster } from "@/lib/tactics/roster";
import { DiagramPageEditor } from "@/components/training/diagram-page-editor";

export const metadata = { title: "Schéma tactique" };

export default async function DiagramPage({ params }: PageProps<"/entrainement/schemas/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("tactical_diagrams").select("id, title, data, archived_at").eq("id", id).maybeSingle();
  const parsed = d ? parseDiagram(d.data) : null;
  if (!d || !parsed) notFound();
  return (
    <>
      <PageHeader eyebrow="Schémas tactiques" title={d.title} description={d.archived_at ? "Schéma archivé." : undefined} />
      <DiagramPageEditor key={d.id} id={d.id} title={d.title} data={parsed} canWrite={can(ctx, "planning.write")} roster={await loadRoster(ctx)} />
    </>
  );
}
