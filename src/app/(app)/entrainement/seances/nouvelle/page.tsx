import { requirePermission } from "@/lib/auth";
import { listStaffOptions } from "@/lib/phase2/data";
import { todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveSession } from "../../actions";
import { sessionFields } from "../fields";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage({ searchParams }: PageProps<"/entrainement/seances/nouvelle">) {
  const ctx = await requirePermission("planning.write");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIso();
  const staff = await listStaffOptions(ctx);
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Nouvelle séance" description="Le numéro de séance est attribué automatiquement. Vous ajouterez ensuite les exercices bloc par bloc." />
      <AutoForm action={saveSession.bind(null, null)} fields={sessionFields(staff, { session_date: date })} submitLabel="Créer la séance" cancelHref="/entrainement/seances" />
    </>
  );
}
