import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadGameVersion } from "@/lib/performance/collective-data";
import { deleteGameDraft } from "@/lib/performance/game-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { GameNav } from "@/components/game/game-nav";
import { Notice } from "@/components/phase2/notice";
import { ActionButton } from "@/components/phase2/action-button";
import { GameModelView, PublishGameButton } from "@/components/game/game-model";

export const metadata = { title: "Version du projet de jeu" };

export default async function GameVersionPage({ params }: PageProps<"/projet-de-jeu/versions/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const version = await loadGameVersion(id);
  if (!version) notFound();
  const editable = version.status === "brouillon" && can(ctx, "frameworks.manage");
  const supabase = await createClient();
  const { data: ex } = await supabase.from("exercises").select("id, title").eq("club_id", ctx.clubId).is("archived_at", null).order("title");
  return (
    <div>
      <PageHeader eyebrow={`Projet de jeu · version ${version.versionNo}`} title={version.label}
        description={version.status === "brouillon" ? "Brouillon : modifiez les pondérations, les principes, les sous-principes et les exercices liés, puis publiez." : version.status === "publie" ? "Version publiée : figée." : "Version archivée : conservée pour l'historique des évaluations."}
        actions={<Button asChild variant="outline"><Link href="/projet-de-jeu">Projet de jeu publié</Link></Button>} />
      <GameNav />
      {editable ? (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3">
          <PublishGameButton id={version.id} />
          <span className="flex-1" />
          <ActionButton action={deleteGameDraft.bind(null, version.id)} confirm="Supprimer le brouillon">Supprimer le brouillon</ActionButton>
        </div>
      ) : version.status === "brouillon" ? <div className="mb-4"><Notice tone="info">Brouillon en lecture seule pour votre rôle.</Notice></div> : null}
      <GameModelView version={version} editable={editable} exercises={ex ?? []} />
    </div>
  );
}
