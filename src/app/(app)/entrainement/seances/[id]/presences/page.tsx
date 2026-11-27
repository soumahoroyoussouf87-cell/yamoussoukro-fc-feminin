import { redirect } from "next/navigation";

/** Les présences se saisissent à l'étape 5 de la fiche de séance. */
export default async function SessionAttendanceRedirect({ params }: PageProps<"/entrainement/seances/[id]/presences">) {
  const { id } = await params;
  redirect(`/entrainement/seances/${id}?etape=5`);
}
