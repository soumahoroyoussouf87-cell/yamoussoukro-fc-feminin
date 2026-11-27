import Link from "next/link";
import { ImageIcon, Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, listPlayerOptions } from "@/lib/phase2/data";
import { setWorkflowStatus } from "@/lib/phase2/workflow-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { SquadForm } from "@/components/phase2/squad-form";
import { createSquad, saveSquad } from "../../../actions";

export const metadata = { title: "Convocation" };

export default async function SquadPage({ params }: PageProps<"/competition/rencontres/[id]/convocations">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: squad } = await supabase.from("match_squads").select("id, status, size_limit, notes, match_squad_players(player_id, status, shirt_number)").eq("match_id", id).maybeSingle();
  const write = can(ctx, "matches.write");
  if (!squad) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1">Aucune convocation pour ce match. La limite par défaut est celle de la compétition (18 joueuses), modifiable ensuite.</span>
        {write ? <ActionButton action={createSquad.bind(null, id)} variant="default">Créer la convocation</ActionButton> : null}
      </Card>
    );
  }
  const showComments = can(ctx, "lineups.read_draft");
  const [players, history, comments] = await Promise.all([
    listPlayerOptions(ctx),
    getApprovalHistory("match_squads", squad.id),
    showComments ? supabase.rpc("squad_confidential_comments", { p_squad: squad.id }) : Promise.resolve({ data: [] as { player_id: string; confidential_comment: string | null }[] }),
  ]);
  const cm = new Map((comments.data ?? []).map((c) => [c.player_id, c.confidential_comment]));
  const initial = Object.fromEntries((squad.match_squad_players ?? []).map((p) => [p.player_id, { status: p.status, shirt: p.shirt_number, comment: cm.get(p.player_id) ?? null }]));
  const locked = ["valide", "publie", "archive"].includes(squad.status) && !can(ctx, "lineups.validate");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <WorkflowBar status={squad.status} canWrite={write} canValidate={can(ctx, "lineups.validate")} onChange={setWorkflowStatus.bind(null, "match_squads", squad.id, `/competition/rencontres/${id}/convocations`)}
            validateHint="La convocation est validée puis publiée par l'entraîneur principal ou la direction sportive. La publication notifie le staff et les joueuses convoquées." />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={`/impression/convocation/${id}`} target="_blank"><Printer />PDF / PNG</Link></Button>
          <Button asChild><Link href={`/impression/affiche-convocation/${id}`} target="_blank"><ImageIcon />Affiche des convoquées</Link></Button>
        </div>
      </div>
      <ApprovalHistory items={history} />
      <SquadForm action={saveSquad.bind(null, squad.id, id)} players={players} initial={initial} sizeLimit={squad.size_limit} notes={squad.notes} readOnly={!write || locked} showComments={showComments} />
    </div>
  );
}
