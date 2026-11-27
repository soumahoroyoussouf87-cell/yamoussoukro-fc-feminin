import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, dayShort } from "@/lib/phase2/labels";
import { loadExercise } from "@/lib/training/exercise";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { TacticalBoard } from "@/components/training/tactical-board";
import { archiveExercise, deleteExercise } from "../../actions";

export const metadata = { title: "Exercice" };

export default async function ExercisePage({ params, searchParams }: PageProps<"/entrainement/exercices/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const r = await loadExercise(supabase, id);
  if (!r) notFound();
  const e = r.exercise;
  const { data: uses } = await supabase.from("session_exercises").select("id, training_sessions(id, number, session_date, theme)").eq("exercise_id", id).limit(30);
  const write = can(ctx, "planning.write");
  const rows: [string, string | null][] = [
    ["Objectif", e.objective], ["Organisation", e.organisation], ["Consignes", e.instructions], ["Déroulement / progression", e.progression],
    ["Contraintes", e.constraints], ["Critères de réalisation", e.realisation_criteria], ["Critères de réussite", e.success_criteria],
    ["Points de coaching", e.coaching_points], ["Variantes", e.variables], ["Corrections attendues", e.corrections], ["Matériel", e.equipment],
  ];
  const facts: [string, string | null][] = [
    ["Dimensions", e.dimensions], ["Joueuses", e.players_count], ["Durée", e.duration_min ? `${e.series && e.series > 1 ? `${e.series} × ` : ""}${e.duration_min} min` : null], ["Répétitions", e.repetitions], ["Récupération", e.recovery],
  ];
  return (
    <>
      <PageHeader eyebrow={CATEGORY_LABELS[e.category]} title={e.title}
        actions={write ? (
          <>
            <Button asChild variant="outline"><Link href={`/entrainement/exercices/${id}/modifier`}><Pencil />Modifier</Link></Button>
            <ActionButton action={archiveExercise.bind(null, id, !r.archived)} size="default">{r.archived ? "Réactiver" : "Archiver"}</ActionButton>
            {(uses ?? []).length === 0 ? <ActionButton action={deleteExercise.bind(null, id)} size="default" confirm="Supprimer définitivement">Supprimer</ActionButton> : null}
          </>
        ) : null} />
      {sp.ok ? <Notice>Exercice enregistré.</Notice> : null}
      {r.archived ? <Notice tone="warning">Exercice archivé : il n&apos;est plus proposé dans les nouvelles séances.</Notice> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {facts.map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="text-sm font-semibold">{v ?? "—"}</dd></div>)}
            </dl>
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</h2><p className="whitespace-pre-line text-sm">{v}</p></div>
            ))}
            {e.video_links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-text hover:underline"><ExternalLink className="size-4" />{l.title}</a>)}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Schéma</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {r.diagram ? <TacticalBoard initial={r.diagram.data} title={r.diagram.title} readOnly /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {!r.diagram && e.diagram_image ? <img src={e.diagram_image} alt={`Schéma de l'exercice ${e.title}`} className="w-full rounded-md border" /> : null}
              {!r.diagram && !e.diagram_image ? <p className="text-sm text-muted-foreground">Aucun schéma.{write ? " Dessine-le depuis « Modifier »." : ""}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Utilisé dans</CardTitle></CardHeader>
            <CardContent>
              {(uses ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune séance.</p> : (
                <ul className="flex flex-col gap-1 text-sm">
                  {(uses ?? []).map((u) => u.training_sessions ? (
                    <li key={u.id}><Link className="hover:underline" href={`/entrainement/seances/${u.training_sessions.id}`}>Séance n°{u.training_sessions.number} · {dayShort(u.training_sessions.session_date)}{u.training_sessions.theme ? ` · ${u.training_sessions.theme}` : ""}</Link></li>
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
