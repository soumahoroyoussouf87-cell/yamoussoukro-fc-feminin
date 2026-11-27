import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { DiagramPageEditor } from "@/components/training/diagram-page-editor";

export const metadata = { title: "Nouveau schéma" };

export default async function NewDiagramPage() {
  await requirePermission("planning.write");
  return (
    <>
      <PageHeader eyebrow="Schémas tactiques" title="Nouveau schéma" />
      <DiagramPageEditor id={null} title="Nouveau schéma" data={null} canWrite />
    </>
  );
}
