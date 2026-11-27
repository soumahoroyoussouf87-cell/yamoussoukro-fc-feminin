import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { loadRoster } from "@/lib/tactics/roster";
import { DiagramPageEditor } from "@/components/training/diagram-page-editor";

export const metadata = { title: "Nouveau schéma" };

export default async function NewDiagramPage() {
  const ctx = await requirePermission("planning.write");
  return (
    <>
      <PageHeader eyebrow="Schémas tactiques" title="Tableau tactique" description="Place les joueuses (avec leur nom), le ballon, les flèches et les zones. Ajoute des étapes pour animer le mouvement, puis enregistre pour l'exporter en PNG ou en PDF." />
      <DiagramPageEditor id={null} title="Nouveau schéma" data={null} canWrite roster={await loadRoster(ctx)} />
    </>
  );
}
