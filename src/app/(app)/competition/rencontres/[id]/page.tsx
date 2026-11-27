import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Printer } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch } from "@/lib/phase2/data";
import { scoreFromEvents } from "@/lib/domain/player-stats";
import { LINEUP_STATUS_LABELS, WORKFLOW_LABELS, workflowVariant } from "@/lib/phase2/labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { deleteMatch } from "../../actions";

export const metadata = { title: "Match Center" };

function Step({ done, title, children, href, action }: { done: boolean; title: string; children: React.ReactNode; href: string; action: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Prêt" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="À faire" />}
        <div className="flex-1"><CardTitle className="text-base">{title}</CardTitle><CardDescription>{children}</CardDescription></div>
      </CardHeader>
      <CardContent><Button asChild variant="outline" size="sm"><Link href={href}>{action}</Link></Button></CardContent>
    </Card>
  );
}

export default async function MatchCenterPage({ params, searchParams }: PageProps<"/competition/rencontres/[id]">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const [{ data: squad }, { data: lineups }, { data: delegation }, { data: events }] = await Promise.all([
    supabase.from("match_squads").select("status, size_limit, match_squad_players(status)").eq("match_id", id).maybeSingle(),
    supabase.from("lineups").select("id, label, status").eq("match_id", id),
    supabase.from("delegations").select("status, delegation_members(id)").eq("match_id", id).maybeSingle(),
    supabase.from("match_events").select("type").eq("match_id", id),
  ]);
  const convoked = (squad?.match_squad_players ?? []).filter((p) => p.status === "convoquee").length;
  const official = (lineups ?? []).find((l) => l.status !== "provisoire");
  const sc = scoreFromEvents(events ?? []);
  const base = `/competition/rencontres/${id}`;
  return (
    <>
      {sp.ok ? <Notice>Rencontre enregistrée.</Notice> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Step done={!!(m.objectives || m.game_plan)} title="Dossier d'avant-match" href={`${base}/modifier`} action="Ouvrir le dossier">
          {m.objectives || m.game_plan ? "Objectifs et plan de jeu renseignés." : "Objectifs, plan de jeu, causerie, rendez-vous et logistique."}
        </Step>
        <Step done={squad?.status === "publie"} title="Convocation" href={`${base}/convocations`} action="Gérer la convocation">
          {squad ? <><Badge variant={workflowVariant(squad.status)}>{WORKFLOW_LABELS[squad.status]}</Badge> {convoked}/{squad.size_limit} convoquées</> : "Non créée."}
        </Step>
        <Step done={!!official} title="Onze de départ" href={`${base}/onze`} action="Composer le onze">
          {official ? <>{official.label} · <Badge variant="success">{LINEUP_STATUS_LABELS[official.status]}</Badge></> : (lineups ?? []).length ? `${(lineups ?? []).length} composition(s) provisoire(s), confidentielle(s).` : can(ctx, "lineups.read_draft") ? "Aucune composition." : "Pas encore communiquée."}
        </Step>
        <Step done={delegation?.status === "valide" || delegation?.status === "publie"} title="Délégation" href={`${base}/delegation`} action="Préparer la délégation">
          {delegation ? <><Badge variant={workflowVariant(delegation.status)}>{WORKFLOW_LABELS[delegation.status]}</Badge> {(delegation.delegation_members ?? []).length} membre(s)</> : "Non créée."}
        </Step>
        <Step done={(events ?? []).length > 0} title="Pendant le match" href={`${base}/direct`} action="Saisir les événements">
          {(events ?? []).length ? `${(events ?? []).length} événement(s) · score d'après les événements : ${sc.us} – ${sc.them}` : "Buts, cartons, remplacements, changements tactiques, observations."}
        </Step>
        <Step done={!!m.post_report} title="Après-match" href={`${base}/rapport`} action="Rédiger le rapport">
          {m.post_report ? "Rapport rédigé." : "Score final, rapport, statistiques et axes de travail."}
        </Step>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href={`/impression/convocation/${id}`} target="_blank"><Printer />Convocation</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={`/impression/onze/${id}`} target="_blank"><Printer />Onze de départ</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={`/impression/delegation/${id}`} target="_blank"><Printer />Délégation officielle</Link></Button>
        {can(ctx, "evaluations.write") ? <Button asChild variant="outline" size="sm"><Link href={`/performance/collective/nouvelle?match=${id}`}>Évaluer le collectif</Link></Button> : null}
        <span className="flex-1" />
        {can(ctx, "matches.write") ? <ActionButton action={deleteMatch.bind(null, id)} confirm="Supprimer le match et tout son dossier">Supprimer le match</ActionButton> : null}
      </div>
    </>
  );
}
