import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveExercise } from "../../actions";
import { exerciseFields } from "../fields";

export const metadata = { title: "Nouvel exercice" };

export default async function NewExercisePage() {
  await requirePermission("planning.write");
  return (
    <>
      <PageHeader eyebrow="Bibliothèque d'exercices" title="Nouvel exercice" />
      <AutoForm action={saveExercise.bind(null, null)} fields={exerciseFields()} submitLabel="Créer l'exercice" cancelHref="/entrainement/exercices" />
    </>
  );
}
