import { redirect } from "next/navigation";

/** L'impression passe par les modèles PDF de l'étape 8 (aperçu, impression, exports). */
export default async function PrintSessionRedirect({ params }: PageProps<"/impression/seance/[id]">) {
  const { id } = await params;
  redirect(`/entrainement/seances/${id}?etape=8`);
}
