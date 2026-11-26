import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BLOCK_LABELS, CATEGORY_LABELS, dayShort } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { archiveExercise, deleteExercise } from "../../actions";

export const metadata = { title: "Exercice" };

export default async function ExercisePage({ params, searchParams }: PageProps<"/entrainement/exercices/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: e } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [{ data: uses }, diagram] = await Promise.all([
    supabase.from("session_exercises").select("id, block, training_sessions(id, number, session_date, theme)").eq("exercise_id", id).limit(30),
    e.diagram_path ? supabase.storage.from("exercise-diagrams").createSignedUrl(e.diagram_path, 3600) : Promise.resolve({ data: null }),
  ]);
  const write = can(ctx, "planning.write");
  const rows: [string, string | number | null][] = [
    ["Objectif", e.objective], ["Organisation", e.organisation], ["Consignes", e.instructions], ["Critères de réussite", e.success_criteria],
    ["Variables", e.variables], ["Corrections attendues", e.corrections],
  ];
  const facts: [string, string | number | null][] = [
    ["Dimensions", e.dimensions], ["Joueuses", e.players_count], ["Durée", e.duration_min ? `${e.duration_min} min` : null], ["Répétitions", e.repetitions], ["Récupération", e.recovery],
  ];
  return (
    <>
      <PageHeader eyebrow={CATEGORY_LABELS[e.category]} title={e.title}
        actions={write ? (
          <>
            <Button asChild variant="outline"><Link href={`/entrainement/exercices/${id}/modifier`}><Pencil />Modifier</Link></Button>
            <ActionButton action={archiveExercise.bind(null, id, !e.archived_at)} size="default">{e.archived_at ? "Réactiver" : "Archiver"}</ActionButton>
            {(uses ?? []).length === 0 ? <ActionButton action={deleteExercise.bind(null, id)} size="default" confirm="Supprimer définitivement">Supprimer</ActionButton> : null}
          </>
        ) : null} />
      {sp.ok ? <Notice>Exercice enregistré.</Notice> : null}
      {e.archived_at ? <Notice tone="warning">Exercice archivé : il n&apos;est plus proposé dans les nouvelles séances.</Notice> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {facts.map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="text-sm font-semibold">{v ?? "—"}</dd></div>)}
            </dl>
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</h2><p className="whitespace-pre-line text-sm">{v}</p></div>
            ))}
            {e.video_url ? <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-text hover:underline"><ExternalLink className="size-4" />Voir la vidéo</a> : null}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Schéma</CardTitle></CardHeader>
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {diagram.data?.signedUrl ? <img src={diagram.data.signedUrl} alt={`Schéma de l'exercice ${e.title}`} className="w-full rounded-md border" /> : <p className="text-sm text-muted-foreground">Aucun schéma.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Utilisé dans</CardTitle></CardHeader>
            <CardContent>
              {(uses ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune séance.</p> : (
                <ul className="flex flex-col gap-1 text-sm">
                  {(uses ?? []).map((u) => u.training_sessions ? (
                    <li key={u.id}><Link className="hover:underline" href={`/entrainement/seances/${u.training_sessions.id}`}>Séance n°{u.training_sessions.number} · {dayShort(u.training_sessions.session_date)} · {u.training_sessions.theme}</Link> <Badge variant="outline">{BLOCK_LABELS[u.block]}</Badge></li>
                  ) : null)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
