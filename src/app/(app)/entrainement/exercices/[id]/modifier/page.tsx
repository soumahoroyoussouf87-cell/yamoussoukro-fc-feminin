import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveExercise } from "../../../actions";
import { exerciseFields } from "../../fields";

export const metadata = { title: "Modifier l'exercice" };

export default async function EditExercisePage({ params }: PageProps<"/entrainement/exercices/[id]/modifier">) {
  await requirePermission("planning.write");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <PageHeader eyebrow="Bibliothèque d'exercices" title={`Modifier — ${data.title}`} />
      <AutoForm action={saveExercise.bind(null, id)} fields={exerciseFields(data)} submitLabel="Enregistrer" cancelHref={`/entrainement/exercices/${id}`} />
    </>
  );
}
