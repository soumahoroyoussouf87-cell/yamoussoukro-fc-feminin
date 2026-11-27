import Link from "next/link";
import { Shield } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGameModel, getPublishedGameVersion, listCompactnessTargets } from "@/lib/performance/collective-data";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GameNav } from "@/components/game/game-nav";
import { CompactnessTargets, GameModelView, NewGameDraftForm } from "@/components/game/game-model";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Projet de jeu" };

const STATUS: Record<string, { label: string; variant: "success" | "outline" | "secondary" }> = {
  publie: { label: "Publiée", variant: "success" }, brouillon: { label: "Brouillon", variant: "outline" }, archive: { label: "Archivée", variant: "secondary" },
};

export default async function GameModelPage() {
  const ctx = await requirePermission("evaluations.read");
  const [model, version, targets] = await Promise.all([getGameModel(ctx), getPublishedGameVersion(ctx), listCompactnessTargets(ctx)]);
  const manage = can(ctx, "frameworks.manage");
  const supabase = await createClient();
  const { data: ex } = await supabase.from("exercises").select("id, title").eq("club_id", ctx.clubId).is("archived_at", null).order("title");
  return (
    <div>
      <PageHeader eyebrow="Tactique" title="Projet de jeu"
        description="Le projet de jeu officiel, organisé autour des cinq moments du jeu. Il sert de référentiel aux évaluations collectives. Une version publiée est figée : toute évolution passe par une nouvelle version."
        actions={model?.draft ? <Button asChild><Link href={`/projet-de-jeu/versions/${model.draft.id}`}>Reprendre le brouillon</Link></Button> : null} />
      <GameNav />
      {!model || !version ? <EmptyState icon={Shield} title="Aucun projet de jeu publié" description="Le projet de jeu initial n'a pas été créé." /> : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="mb-3 text-sm text-muted-foreground">Version publiée : <strong className="text-foreground">v{version.versionNo} · {version.label}</strong>{version.publishedAt ? ` · depuis le ${formatDate(version.publishedAt)}` : ""}</p>
            <GameModelView version={version} editable={false} exercises={ex ?? []} />
          </div>
          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Versions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ul className="divide-y text-sm">
                  {model.versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link className="hover:underline" href={`/projet-de-jeu/versions/${v.id}`}>v{v.version_no} · {v.label}</Link>
                      <Badge variant={STATUS[v.status].variant}>{STATUS[v.status].label}</Badge>
                    </li>
                  ))}
                </ul>
                {manage && !model.draft ? <NewGameDraftForm fromId={version.id} /> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Objectifs de compacité</CardTitle><CardDescription>Distance visée entre les lignes, selon la situation de jeu.</CardDescription></CardHeader>
              <CardContent><CompactnessTargets targets={targets} editable={manage} /></CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
