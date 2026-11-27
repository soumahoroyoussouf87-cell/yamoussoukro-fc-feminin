import { redirect } from "next/navigation";

/** Ancienne page de modification : la fiche se modifie désormais dans l'assistant en 8 étapes. */
export default async function EditSessionRedirect({ params }: PageProps<"/entrainement/seances/[id]/modifier">) {
  const { id } = await params;
  redirect(`/entrainement/seances/${id}?etape=1`);
}
