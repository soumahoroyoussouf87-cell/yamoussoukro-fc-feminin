import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listStaffOptions } from "@/lib/phase2/data";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { Notice } from "@/components/phase2/notice";
import { saveSession } from "../../../actions";
import { sessionFields } from "../../fields";

export const metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({ params }: PageProps<"/entrainement/seances/[id]/modifier">) {
  const ctx = await requirePermission("planning.write");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("training_sessions").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const staff = await listStaffOptions(ctx);
  const locked = ["valide", "publie", "archive"].includes(data.status) && !ctx.permissions.has("planning.validate");
  return (
    <>
      <PageHeader eyebrow="Entraînement" title={`Séance n°${data.number} — modifier`} />
      {locked ? <Notice tone="warning">Séance validée : seule l&apos;entraîneur principal ou la direction sportive peut la modifier.</Notice> : null}
      {data.status === "publie" ? <Notice tone="info">Séance publiée : un changement de date ou d&apos;horaire notifiera le staff.</Notice> : null}
      <AutoForm action={saveSession.bind(null, id)} fields={sessionFields(staff, data)} submitLabel="Enregistrer" cancelHref={`/entrainement/seances/${id}`} />
    </>
  );
}
