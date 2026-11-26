import { redirect } from "next/navigation";
import { StatusPage } from "@/components/ui/status-page";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Accès en attente" };

export default async function PendingPage() {
  const ctx = await requireUser();
  if (ctx.clubId) redirect("/tableau-de-bord");
  return (
    <StatusPage title="Accès en attente" back={false}>
      <p>Votre compte <strong>{ctx.email}</strong> est actif, mais aucun rôle ne vous a encore été attribué.</p>
      <p>Contactez l&apos;administrateur de la plateforme : il doit vous attribuer un rôle dans Administration › Utilisateurs.</p>
    </StatusPage>
  );
}
