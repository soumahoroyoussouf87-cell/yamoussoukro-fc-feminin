import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadExercise } from "@/lib/training/exercise";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ExerciseEditor } from "@/components/training/exercise-editor";

export const metadata = { title: "Modifier l'exercice" };

export default async function EditExercisePage({ params }: PageProps<"/entrainement/exercices/[id]/modifier">) {
  await requirePermission("planning.write");
  const { id } = await params;
  const supabase = await createClient();
  const r = await loadExercise(supabase, id);
  if (!r) notFound();
  return (
    <>
      <PageHeader eyebrow="Bibliothèque d'exercices" title={r.exercise.title} actions={<Button asChild variant="outline"><Link href={`/entrainement/exercices/${id}`}>Terminer</Link></Button>} />
      <ExerciseEditor exercise={r.exercise} diagram={r.diagram} />
    </>
  );
}
