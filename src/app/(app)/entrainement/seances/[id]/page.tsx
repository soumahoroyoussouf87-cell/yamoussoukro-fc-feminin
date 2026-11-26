import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ListChecks, Pencil, Printer, Trash2 } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory } from "@/lib/phase2/data";
import { ATTENDANCE_LABELS, BLOCK_LABELS, CATEGORY_LABELS, dayLong, hm, INTENSITY_LABELS } from "@/lib/phase2/labels";
import { setWorkflowStatus } from "@/lib/phase2/workflow-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoForm } from "@/components/phase2/auto-form";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { Notice } from "@/components/phase2/notice";
import { addSessionExercise, deleteSession, duplicateSession, moveSessionExercise, removeSessionExercise, saveSessionEvaluation } from "../../actions";

export const metadata = { title: "Fiche de séance" };

export default async function SessionPage({ params, searchParams }: PageProps<"/entrainement/seances/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select("*, staff_members(first_name, last_name), session_exercises(*, exercises(id, title, category, objective, instructions)), training_attendance(status), session_evaluations(*)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const write = can(ctx, "planning.write");
  const validate = can(ctx, "planning.validate");
  const locked = ["valide", "publie", "archive"].includes(s.status) && !validate;
  const editable = write && !locked;
  const [history, { data: library }] = await Promise.all([
    getApprovalHistory("training_sessions", id),
    editable ? supabase.from("exercises").select("id, title, category").eq("club_id", ctx.clubId).is("archived_at", null).order("category").order("title") : Promise.resolve({ data: [] }),
  ]);
  const items = [...(s.session_exercises ?? [])];
  const blocks = Object.keys(BLOCK_LABELS).filter((b) => items.some((i) => i.block === b));
  const total = items.reduce((a, i) => a + (i.duration_min ?? 0), 0);
  const att = s.training_attendance ?? [];
  const attCount = new Map<string, number>();
  for (const a of att) attCount.set(a.status, (attCount.get(a.status) ?? 0) + 1);
  const ev = Array.isArray(s.session_evaluations) ? s.session_evaluations[0] : s.session_evaluations;
  const info: [string, string | null][] = [
    ["Date", dayLong(s.session_date)], ["Horaires", [hm(s.starts_at), hm(s.ends_at)].filter(Boolean).join(" – ") || null], ["Lieu", s.location],
    ["Intensité", s.intensity ? INTENSITY_LABELS[s.intensity] : null], ["Système", s.game_system], ["Public", s.audience],
    ["Responsable", s.staff_members ? `${s.staff_members.first_name} ${s.staff_members.last_name}` : null], ["Durée des exercices", total ? `${total} min` : null],
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Séance n°${s.number}`}
        title={s.theme}
        description={s.sub_theme ?? undefined}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/impression/seance/${id}`} target="_blank"><Printer />Imprimer / PDF</Link></Button>
            <Button asChild variant="outline"><Link href={`/entrainement/seances/${id}/presences`}><ListChecks />Présences</Link></Button>
            {editable ? <Button asChild variant="outline"><Link href={`/entrainement/seances/${id}/modifier`}><Pencil />Modifier</Link></Button> : null}
            {write && (s.status === "brouillon" || s.status === "soumis" || validate) ? <ActionButton action={deleteSession.bind(null, id)} size="default" confirm="Supprimer la séance">Supprimer</ActionButton> : null}
          </>
        }
      />
      {sp.ok ? <Notice>Séance enregistrée.</Notice> : null}
      {sp.copie ? <Notice>Séance dupliquée (nouvelle séance en brouillon).</Notice> : null}

      <div className="mb-4 flex flex-col gap-2">
        <WorkflowBar status={s.status} canWrite={write} canValidate={validate} onChange={setWorkflowStatus.bind(null, "training_sessions", id, `/entrainement/seances/${id}`)}
          validateHint="La séance est validée puis publiée par l'entraîneur principal ou la direction sportive. La publication notifie le staff ; une fois publiée, elle est visible des joueuses." />
        <ApprovalHistory items={history} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              {info.map(([k, v]) => <div key={k}><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="text-sm font-semibold">{v ?? "—"}</p></div>)}
              {s.main_objective ? <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs uppercase text-muted-foreground">Objectif principal</p><p className="whitespace-pre-line text-sm">{s.main_objective}</p></div> : null}
              {s.secondary_objectives ? <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs uppercase text-muted-foreground">Objectifs secondaires</p><p className="whitespace-pre-line text-sm">{s.secondary_objectives}</p></div> : null}
              {s.equipment ? <div className="sm:col-span-2"><p className="text-xs uppercase text-muted-foreground">Matériel</p><p className="whitespace-pre-line text-sm">{s.equipment}</p></div> : null}
              {s.notes ? <div className="sm:col-span-2"><p className="text-xs uppercase text-muted-foreground">Remarques</p><p className="whitespace-pre-line text-sm">{s.notes}</p></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Déroulé de la séance</CardTitle>
              <CardDescription>{items.length} exercice(s){total ? ` · ${total} min` : ""}. Les exercices viennent de la bibliothèque.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {blocks.length === 0 ? <p className="text-sm text-muted-foreground">Aucun exercice pour l&apos;instant.</p> : null}
              {blocks.map((b) => {
                const list = items.filter((i) => i.block === b).sort((x, y) => x.sort_order - y.sort_order);
                return (
                  <section key={b}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-text">{BLOCK_LABELS[b]} · {list.reduce((a, i) => a + (i.duration_min ?? 0), 0)} min</h3>
                    <ul className="flex flex-col gap-1">
                      {list.map((i, k) => (
                        <li key={i.id} className="flex items-start gap-3 rounded-md border p-2 text-sm">
                          <div className="min-w-0 flex-1">
                            {i.exercises ? <Link href={`/entrainement/exercices/${i.exercises.id}`} className="font-semibold hover:underline">{i.exercises.title}</Link> : "Exercice"}
                            {i.exercises ? <Badge variant="outline" className="ml-2">{CATEGORY_LABELS[i.exercises.category]}</Badge> : null}
                            <p className="text-xs text-muted-foreground">{[i.duration_min ? `${i.duration_min} min` : null, i.repetitions, i.recovery ? `récup. ${i.recovery}` : null].filter(Boolean).join(" · ")}</p>
                            {i.notes ? <p className="text-xs">{i.notes}</p> : null}
                          </div>
                          {editable ? (
                            <div className="flex items-center gap-0.5">
                              {k > 0 ? <ActionButton action={moveSessionExercise.bind(null, id, i.id, -1)} variant="ghost"><ArrowUp className="size-4" aria-label="Monter" /></ActionButton> : null}
                              {k < list.length - 1 ? <ActionButton action={moveSessionExercise.bind(null, id, i.id, 1)} variant="ghost"><ArrowDown className="size-4" aria-label="Descendre" /></ActionButton> : null}
                              <ActionButton action={removeSessionExercise.bind(null, id, i.id)} variant="ghost" confirm="Retirer"><Trash2 className="size-4" aria-label="Retirer" /></ActionButton>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {editable ? (
                <details className="rounded-lg border border-dashed p-3" open={items.length === 0}>
                  <summary className="cursor-pointer text-sm font-semibold">Ajouter un exercice</summary>
                  <div className="mt-3">
                    {(library ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">La bibliothèque est vide. <Link href="/entrainement/exercices/nouveau" className="font-semibold text-primary-text underline">Créer un exercice</Link></p>
                    ) : (
                      <AutoForm bare action={addSessionExercise.bind(null, id)} submitLabel="Ajouter"
                        fields={[
                          { name: "block", label: "Bloc", type: "select", required: true, options: Object.entries(BLOCK_LABELS).map(([value, label]) => ({ value, label })), defaultValue: "echauffement" },
                          { name: "exercise_id", label: "Exercice", type: "select", required: true, span: 2, emptyOption: "Choisir dans la bibliothèque…", options: (library ?? []).map((e) => ({ value: e.id, label: `${CATEGORY_LABELS[e.category]} — ${e.title}` })) },
                          { name: "duration_min", label: "Durée (min)", type: "number", min: 1, max: 180 },
                          { name: "repetitions", label: "Répétitions", placeholder: "Ex. 3 x 6 min" },
                          { name: "recovery", label: "Récupération", placeholder: "Ex. 1 min" },
                          { name: "notes", label: "Consignes spécifiques", type: "textarea", span: 3, maxLength: 1000, rows: 2 },
                        ]} />
                    )}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Présences</CardTitle></CardHeader>
            <CardContent>
              {att.length === 0 ? <p className="text-sm text-muted-foreground">Non saisies.</p> : (
                <ul className="flex flex-col gap-1 text-sm">
                  {Object.entries(ATTENDANCE_LABELS).filter(([k]) => attCount.get(k)).map(([k, l]) => <li key={k} className="flex justify-between"><span>{l}</span><strong>{attCount.get(k)}</strong></li>)}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/entrainement/seances/${id}/presences`}>{write ? "Saisir les présences" : "Voir les présences"}</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Évaluation de la séance</CardTitle><CardDescription>À remplir après la séance.</CardDescription></CardHeader>
            <CardContent>
              {write ? (
                <AutoForm bare columns={2} action={saveSessionEvaluation.bind(null, id)} submitLabel="Enregistrer l'évaluation"
                  fields={[
                    { name: "objectives_reached", label: "Objectifs atteints (1-5)", type: "number", min: 1, max: 5, defaultValue: ev?.objectives_reached },
                    { name: "engagement", label: "Engagement (1-5)", type: "number", min: 1, max: 5, defaultValue: ev?.engagement },
                    { name: "intensity_observed", label: "Intensité observée", type: "select", emptyOption: "—", options: Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label })), defaultValue: ev?.intensity_observed },
                    { name: "actual_duration_min", label: "Durée réelle (min)", type: "number", min: 1, max: 300, defaultValue: ev?.actual_duration_min },
                    { name: "strengths", label: "Points positifs", type: "textarea", span: 2, defaultValue: ev?.strengths, maxLength: 2000, rows: 2 },
                    { name: "improvements", label: "Points à améliorer", type: "textarea", span: 2, defaultValue: ev?.improvements, maxLength: 2000, rows: 2 },
                  ]} />
              ) : ev ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Objectifs</dt><dd>{ev.objectives_reached ?? "—"}/5</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Engagement</dt><dd>{ev.engagement ?? "—"}/5</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Points positifs</dt><dd className="whitespace-pre-line">{ev.strengths ?? "—"}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">À améliorer</dt><dd className="whitespace-pre-line">{ev.improvements ?? "—"}</dd></div>
                </dl>
              ) : <p className="text-sm text-muted-foreground">Non évaluée.</p>}
            </CardContent>
          </Card>

          {write ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Dupliquer</CardTitle><CardDescription>Copie la séance et ses exercices à une autre date (en brouillon).</CardDescription></CardHeader>
              <CardContent>
                <AutoForm bare columns={1} action={duplicateSession.bind(null, id)} submitLabel="Dupliquer" fields={[{ name: "date", label: "Nouvelle date", type: "date", required: true }]} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
