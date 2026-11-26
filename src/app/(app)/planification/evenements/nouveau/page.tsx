import { requirePermission } from "@/lib/auth";
import { listStaffOptions } from "@/lib/phase2/data";
import { todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveEvent } from "../../actions";
import { eventFields } from "../../event-fields";

export const metadata = { title: "Nouvelle activité" };

export default async function NewEventPage({ searchParams }: PageProps<"/planification/evenements/nouveau">) {
  const ctx = await requirePermission("planning.write");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIso();
  const staff = await listStaffOptions(ctx);
  return (
    <>
      <PageHeader eyebrow="Planification" title="Nouvelle activité" description="Séance vidéo, tests physiques, réunion, déplacement, stage, repos, récupération ou soins. Les séances d'entraînement et les matchs se créent dans leurs modules." />
      <AutoForm action={saveEvent.bind(null, null)} fields={eventFields(staff, { event_date: date })} submitLabel="Créer l'activité" cancelHref={`/planification/calendrier?date=${date}`} />
    </>
  );
}
