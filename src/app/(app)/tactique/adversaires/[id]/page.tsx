import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Swords } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { loadOpponent, resultOf } from "@/lib/tactics/data";
import { HOME_AWAY_LABELS } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamLogo } from "@/components/phase2/team-logo";
import { NewScoutingForm, ScoutingCard, type Scouting } from "@/components/tactics/scouting";

export const metadata = { title: "Adversaire" };

export default async function OpponentPage({ params }: PageProps<"/tactique/adversaires/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const data = await loadOpponent(ctx, id);
  if (!data) notFound();
  const { opponent: o, h2h, scouting } = data;
  const today = new Date().toISOString().slice(0, 10);
  const next = h2h.find((m) => m.date >= today && m.status === "programme");
  const editable = can(ctx, "evaluations.write");

  return (
    <div>
      <PageHeader eyebrow="Analyse des adversaires" title={o.name}
        description={o.city ? `Ville : ${o.city}` : "Fiches d'observation et confrontations."}
        actions={
          <div className="flex flex-wrap gap-2">
            {next ? <Button asChild><Link href={`/impression/avant-match/${next.id}`} target="_blank"><Printer />Rapport d&apos;avant-match</Link></Button> : null}
            <Button asChild variant="outline"><Link href="/tactique/adversaires">Tous les adversaires</Link></Button>
          </div>
        } />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <TeamLogo name={o.name} path={o.logo_path} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Confrontations</h2>
          {h2h.length === 0 ? <p className="text-sm text-muted-foreground">Aucun match enregistré contre cet adversaire.</p> : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {h2h.map((m) => {
                const r = resultOf(m);
                return (
                  <li key={m.id}>
                    <Link href={`/competition/rencontres/${m.id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 hover:bg-muted">
                      <span className="tabular-nums">{m.date.split("-").reverse().join("/")}</span>
                      <span className="text-xs text-muted-foreground">{HOME_AWAY_LABELS[m.home_away]}</span>
                      {r ? <Badge variant={r === "V" ? "success" : r === "D" ? "danger" : "secondary"}>{r} {m.goals_for}-{m.goals_against}</Badge> : <Badge variant="outline">{m.status === "programme" ? "À venir" : m.status}</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editable ? <div className="mb-4"><NewScoutingForm opponentId={o.id} today={today}
        matches={h2h.filter((m) => m.date <= today).map((m) => ({ id: m.id, date: m.date, label: `${m.date.split("-").reverse().join("/")} · contre YFC${m.matchday ? ` (${m.matchday})` : ""}` }))} /></div> : null}

      {scouting.length === 0 ? (
        <EmptyState icon={Swords} title="Aucune fiche d'observation" description="Créez une fiche après avoir regardé un match de cet adversaire (vidéo ou en direct)." />
      ) : (
        <div className="space-y-4">{scouting.map((s) => <ScoutingCard key={s.id} s={s as unknown as Scouting} editable={editable} />)}</div>
      )}
    </div>
  );
}
