import { redirect } from "next/navigation";
import { StatusPage } from "@/components/ui/status-page";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Espace joueuse" };

export default async function PlayerSpacePage() {
  const ctx = await requireUser();
  if (ctx.isStaff) redirect("/tableau-de-bord");
  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("first_name, last_name").eq("profile_id", ctx.userId).maybeSingle();
  return (
    <StatusPage title="Espace joueuse" back={false}>
      <p>
        Bienvenue{player ? ` ${player.first_name} ${player.last_name}` : ""}. Votre portail personnel (programme, convocations,
        objectifs, vidéos autorisées, évaluations validées) sera ouvert en <strong>Phase 5</strong> de la roadmap.
      </p>
      {!player ? <p className="text-xs text-white/60">Votre compte n&apos;est pas encore relié à votre fiche joueuse. Le staff s&apos;en charge.</p> : null}
    </StatusPage>
  );
}
