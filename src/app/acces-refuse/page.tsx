import { StatusPage } from "@/components/ui/status-page";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Accès refusé" };

export default async function DeniedPage({ searchParams }: PageProps<"/acces-refuse">) {
  await requireUser();
  const { permission } = await searchParams;
  return (
    <StatusPage title="Accès refusé">
      <p>Votre rôle ne donne pas accès à cette page.</p>
      {typeof permission === "string" ? <p className="text-xs text-white/60">Permission requise : <code>{permission}</code></p> : null}
    </StatusPage>
  );
}
