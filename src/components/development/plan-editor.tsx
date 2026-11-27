"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import {
  addAction, addObjective, addReview, createPlan, deleteAction, deleteObjective, deletePlan, deleteReview, updateAction, updateObjective, updatePlan,
  type PlanFormState,
} from "@/lib/development/actions";
import type { Objective, PlanFull } from "@/lib/development/data";
import {
  DECISIONS, DECISION_LABELS, OBJ_DIMENSIONS, OBJ_DIMENSION_LABELS, OBJ_STATUSES, OBJ_STATUS_LABELS, OBJ_STATUS_VARIANT,
  PLAN_STATUSES, PLAN_STATUS_LABELS, PRIORITIES, PRIORITY_LABELS, SCOPES, SCOPE_LABELS, type ObjStatus, type Scope,
} from "./labels";

type Opt = { value: string; label: string };
const fr = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const day = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

// ----------------------------------------------------------------- Création
export function NewPlanForm({ players, staff, sectors, scope: initialScope, playerId, today, defaultEnd }: {
  players: Opt[]; staff: Opt[]; sectors: Opt[]; scope: Scope; playerId?: string; today: string; defaultEnd: string;
}) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [state, action, pending] = useActionState<PlanFormState, FormData>(createPlan, undefined);
  return (
    <form action={action} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2" aria-label="Nouveau plan de développement">
      <Field label="Portée" htmlFor="pl-scope">
        <Select id="pl-scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          {SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
        </Select>
      </Field>
      {scope === "individuel" ? (
        <Field label="Joueuse" htmlFor="pl-player">
          <Select id="pl-player" name="player_id" defaultValue={playerId ?? ""} required>
            <option value="">— Choisir —</option>
            {players.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>
      ) : scope === "sectoriel" ? (
        <Field label="Secteur" htmlFor="pl-sector">
          <Select id="pl-sector" name="sector_code" defaultValue="" required>
            <option value="">— Choisir —</option>
            {sectors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
      ) : <div className="hidden sm:block" />}
      <Field label="Titre du plan" htmlFor="pl-title" className="sm:col-span-2">
        <Input id="pl-title" name="title" required minLength={2} maxLength={160} placeholder="Ex. Jeu long et orientation du corps" />
      </Field>
      <Field label="Début" htmlFor="pl-start"><Input id="pl-start" name="starts_on" type="date" required defaultValue={today} /></Field>
      <Field label="Fin prévue" htmlFor="pl-end"><Input id="pl-end" name="ends_on" type="date" required defaultValue={defaultEnd} /></Field>
      <Field label="Responsable du suivi" htmlFor="pl-owner">
        <Select id="pl-owner" name="owner_staff_id" defaultValue="">
          <option value="">— Non désigné —</option>
          {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </Field>
      <Field label="Première réévaluation" htmlFor="pl-review"><Input id="pl-review" name="next_review_on" type="date" /></Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer le plan"}</Button>
        {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      </div>
    </form>
  );
}

// ----------------------------------------------------------------- En-tête du plan
export function PlanHeaderEditor({ plan, staff, editable }: { plan: PlanFull; staff: Opt[]; editable: boolean }) {
  const save = useAutosave<Record<string, string | null>>(async (patch) => {
    const r = await updatePlan(plan.id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  if (!editable) {
    return (
      <section className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
        <p><strong>Période :</strong> {day(plan.starts_on)} → {day(plan.ends_on)}</p>
        <p><strong>Responsable :</strong> {plan.owner ?? "—"}</p>
        <div><p className="font-semibold">Constats (faits)</p><p className="whitespace-pre-line text-muted-foreground">{plan.findings || "—"}</p></div>
        <div><p className="font-semibold">Analyse du staff</p><p className="whitespace-pre-line text-muted-foreground">{plan.analysis || "—"}</p></div>
      </section>
    );
  }
  return (
    <section aria-label="Paramètres du plan" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase">Le plan</h2>
        <SaveIndicator state={save.state} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Titre" htmlFor="pe-title" className="sm:col-span-2">
          <Input id="pe-title" maxLength={160} defaultValue={plan.title} onChange={(e) => { if (e.target.value.trim().length >= 2) save.queue({ title: e.target.value }); }} />
        </Field>
        <Field label="Statut" htmlFor="pe-status">
          <Select id="pe-status" defaultValue={plan.status} onChange={(e) => save.queue({ status: e.target.value })}>
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_STATUS_LABELS[s]}</option>)}
          </Select>
        </Field>
        <Field label="Responsable du suivi" htmlFor="pe-owner">
          <Select id="pe-owner" defaultValue={plan.owner_staff_id ?? ""} onChange={(e) => save.queue({ owner_staff_id: e.target.value || null })}>
            <option value="">— Non désigné —</option>
            {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Début" htmlFor="pe-start"><Input id="pe-start" type="date" defaultValue={plan.starts_on} onChange={(e) => e.target.value && save.queue({ starts_on: e.target.value })} /></Field>
        <Field label="Fin prévue" htmlFor="pe-end"><Input id="pe-end" type="date" defaultValue={plan.ends_on} onChange={(e) => e.target.value && save.queue({ ends_on: e.target.value })} /></Field>
        <Field label="Prochaine réévaluation" htmlFor="pe-next" className="sm:col-span-2">
          <Input id="pe-next" type="date" key={plan.next_review_on ?? "none"} defaultValue={plan.next_review_on ?? ""} onChange={(e) => save.queue({ next_review_on: e.target.value || null })} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Field label="Constats (faits observés, mesures)" htmlFor="pe-findings">
          <Textarea id="pe-findings" rows={4} maxLength={3000} defaultValue={plan.findings ?? ""} placeholder="Ex. 2 passes longues réussies sur 5 lors des 3 derniers matchs (évaluations validées)."
            onChange={(e) => save.queue({ findings: e.target.value })} />
        </Field>
        <Field label="Analyse du staff (interprétation)" htmlFor="pe-analysis">
          <Textarea id="pe-analysis" rows={4} maxLength={3000} defaultValue={plan.analysis ?? ""} placeholder="Ex. orientation du corps fermée avant la réception ; à travailler en priorité."
            onChange={(e) => save.queue({ analysis: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 border-t pt-3">
        <ConfirmButton label={<><Trash2 />Supprimer le plan</>} confirmLabel="Supprimer définitivement" onConfirm={() => deletePlan(plan.id)} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- Objectifs
export type Suggestion = { code: string; label: string; dimension: string; dimensionCode: string; mean: number; n: number };
export type Measure = { mean: number | null; n: number };

export function AddObjective({ planId, suggestions, usedCodes }: { planId: string; suggestions: Suggestion[]; usedCodes: string[] }) {
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = (input: Parameters<typeof addObjective>[1]) => start(async () => {
    setErr(null);
    const r = await addObjective(planId, input);
    if (r.error) setErr(r.error); else setLabel("");
  });
  const free = suggestions.filter((s) => !usedCodes.includes(s.code));
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
      {free.length ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Axes de travail repérés dans les évaluations validées</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {free.map((s) => (
              <li key={s.code}>
                <Button type="button" size="sm" variant="outline" disabled={pending}
                  onClick={() => add({ label: `Progresser en ${s.label.toLowerCase()}`, dimension: s.dimensionCode as Objective["dimension"], criterion_code: s.code, baseline: s.mean, target: Math.min(100, Math.round(s.mean + 10)), unit: "/100", measure: "Indice moyen du critère dans les évaluations validées (0 à 100)" })}>
                  <Plus />{s.label} · {fr(s.mean)}/100 ({s.n} obs.)
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (label.trim().length >= 2) add({ label }); }}>
        <Field label="Nouvel objectif" htmlFor={`obj-new-${planId}`} className="min-w-0 flex-1">
          <Input id={`obj-new-${planId}`} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Réussir 4 passes longues sur 5 en match" />
        </Field>
        <Button type="submit" disabled={pending || label.trim().length < 2}><Plus />Ajouter l&apos;objectif</Button>
      </form>
      {err ? <p role="alert" className="text-sm text-danger">{err}</p> : null}
    </div>
  );
}

export function ObjectiveCard({ o, index, editable, exercises, measure, criterionLabel }: {
  o: Objective; index: number; editable: boolean; exercises: Opt[]; measure?: Measure; criterionLabel?: string;
}) {
  const save = useAutosave<Record<string, string | number | null>>(async (patch) => {
    const r = await updateObjective(o.id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  const [ex, setEx] = useState("");
  const [free, setFree] = useState("");
  const [freq, setFreq] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => start(async () => {
    setErr(null);
    const r = await fn();
    if (r.error) setErr(r.error); else after?.();
  });
  const id = (k: string) => `o-${o.id}-${k}`;
  return (
    <article id={`objectif-${o.id}`} className="rounded-xl border bg-card p-4" aria-label={`Objectif ${index + 1}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Objectif {index + 1}{o.dimension ? ` · ${OBJ_DIMENSION_LABELS[o.dimension]}` : ""}{criterionLabel ? ` · critère « ${criterionLabel} »` : ""}</p>
          {!editable ? <h3 className="font-semibold">{o.label}</h3> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={OBJ_STATUS_VARIANT[o.status]}>{OBJ_STATUS_LABELS[o.status]}</Badge>
          {editable ? <SaveIndicator state={save.state} /> : null}
        </div>
      </header>

      {editable ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Objectif" htmlFor={id("label")} className="sm:col-span-2 lg:col-span-4">
            <Input id={id("label")} maxLength={200} defaultValue={o.label} onChange={(e) => { if (e.target.value.trim().length >= 2) save.queue({ label: e.target.value }); }} />
          </Field>
          <Field label="Dimension" htmlFor={id("dim")}>
            <Select id={id("dim")} defaultValue={o.dimension ?? ""} onChange={(e) => save.queue({ dimension: e.target.value || null })}>
              <option value="">—</option>
              {OBJ_DIMENSIONS.map((d) => <option key={d} value={d}>{OBJ_DIMENSION_LABELS[d]}</option>)}
            </Select>
          </Field>
          <Field label="Priorité" htmlFor={id("prio")}>
            <Select id={id("prio")} defaultValue={o.priority} onChange={(e) => save.queue({ priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </Select>
          </Field>
          <Field label="Comment on mesure" htmlFor={id("measure")} className="sm:col-span-2 lg:col-span-3">
            <Input id={id("measure")} maxLength={300} defaultValue={o.measure ?? ""} placeholder="Ex. passes longues réussies / tentées en match" onChange={(e) => save.queue({ measure: e.target.value })} />
          </Field>
          <Field label="Départ" htmlFor={id("base")}><Input id={id("base")} inputMode="decimal" defaultValue={fr(o.baseline) === "—" ? "" : fr(o.baseline)} onChange={(e) => save.queue({ baseline: e.target.value })} /></Field>
          <Field label="Cible" htmlFor={id("target")}><Input id={id("target")} inputMode="decimal" defaultValue={fr(o.target) === "—" ? "" : fr(o.target)} onChange={(e) => save.queue({ target: e.target.value })} /></Field>
          <Field label="Unité" htmlFor={id("unit")}><Input id={id("unit")} maxLength={20} defaultValue={o.unit ?? ""} placeholder="/5, %, s…" onChange={(e) => save.queue({ unit: e.target.value })} /></Field>
          <Field label="Échéance" htmlFor={id("due")}><Input id={id("due")} type="date" defaultValue={o.due_on ?? ""} onChange={(e) => save.queue({ due_on: e.target.value || null })} /></Field>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {o.measure ? `${o.measure} · ` : ""}Départ {fr(o.baseline)}{o.unit ?? ""} → cible {fr(o.target)}{o.unit ?? ""}{o.due_on ? ` · échéance ${day(o.due_on)}` : ""} · priorité {PRIORITY_LABELS[o.priority].toLowerCase()}
        </p>
      )}

      {measure ? (
        <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <strong>Mesure actuelle</strong> (évaluations validées depuis le début du plan) :{" "}
          {measure.n ? <>indice {fr(measure.mean)}/100 sur {measure.n} observation{measure.n > 1 ? "s" : ""}</> : "aucune observation pour l'instant"}
        </p>
      ) : null}

      <div className="mt-3">
        <p className="text-sm font-medium">Exercices correctifs</p>
        <ul className="mt-1 space-y-1.5">
          {o.actions.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                {a.exercise ? <a href={`/entrainement/exercices/${a.exercise.id}`} className="font-medium text-primary underline-offset-2 hover:underline">{a.label}</a> : <span className="font-medium">{a.label}</span>}
                {!editable && a.frequency ? <span className="text-muted-foreground"> · {a.frequency}</span> : null}
              </span>
              {editable ? (
                <>
                  <Input aria-label={`Fréquence de ${a.label}`} className="h-8 w-44" maxLength={80} defaultValue={a.frequency ?? ""} placeholder="Ex. 2 fois / semaine"
                    onBlur={(e) => { if (e.target.value !== (a.frequency ?? "")) run(() => updateAction(a.id, { frequency: e.target.value })); }} />
                  <Button type="button" size="sm" variant="ghost" aria-label={`Retirer ${a.label}`} disabled={pending} onClick={() => run(() => deleteAction(a.id))}><X /></Button>
                </>
              ) : null}
            </li>
          ))}
          {!o.actions.length ? <li className="text-sm text-muted-foreground">Aucun exercice prescrit.</li> : null}
        </ul>
        {editable ? (
          <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            const chosen = exercises.find((x) => x.value === ex);
            const label = chosen ? chosen.label : free.trim();
            if (label.length < 2) return;
            run(() => addAction(o.id, { exercise_id: chosen?.value ?? null, label, frequency: freq, notes: null }), () => { setEx(""); setFree(""); setFreq(""); });
          }}>
            {exercises.length ? (
              <Select aria-label="Exercice de la bibliothèque" className="h-9 sm:w-64" value={ex} onChange={(e) => setEx(e.target.value)}>
                <option value="">— Exercice de la bibliothèque —</option>
                {exercises.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </Select>
            ) : null}
            {!ex ? <Input aria-label="Ou consigne libre" className="h-9 min-w-0 flex-1" maxLength={200} value={free} onChange={(e) => setFree(e.target.value)} placeholder={exercises.length ? "… ou consigne libre" : "Exercice ou consigne"} /> : null}
            <Input aria-label="Fréquence" className="h-9 w-40" maxLength={80} value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="Fréquence" />
            <Button type="submit" size="sm" variant="outline" disabled={pending || (!ex && free.trim().length < 2)}><Plus />Prescrire</Button>
          </form>
        ) : null}
      </div>
      {err ? <p role="alert" className="mt-2 text-sm text-danger">{err}</p> : null}
      {editable ? (
        <div className="mt-3 border-t pt-3">
          <ConfirmButton label={<><Trash2 />Retirer l&apos;objectif</>} confirmLabel="Retirer définitivement" onConfirm={() => deleteObjective(o.id)} />
        </div>
      ) : null}
    </article>
  );
}

// ----------------------------------------------------------------- Réévaluations
export function ReviewForm({ planId, objectives, today, measures }: { planId: string; objectives: Objective[]; today: string; measures: Record<string, Measure> }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>("poursuivre");
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setOpen(true); setOk(false); }}><Plus />Nouvelle réévaluation</Button>
        {ok ? <p role="status" className="text-sm text-success">Réévaluation enregistrée.</p> : null}
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Nouvelle réévaluation" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const items = objectives.map((o) => ({
        objective_id: o.id, value: String(fd.get(`val-${o.id}`) ?? ""), status: String(fd.get(`st-${o.id}`)) as ObjStatus, comment: String(fd.get(`com-${o.id}`) ?? ""),
      }));
      start(async () => {
        setErr(null);
        const r = await addReview(planId, {
          reviewed_on: String(fd.get("reviewed_on")), facts: String(fd.get("facts") ?? ""), interpretation: String(fd.get("interpretation") ?? ""),
          decision, next_review_on: String(fd.get("next_review_on") ?? ""), items,
        });
        if (r.error) setErr(r.error); else { setOpen(false); setOk(true); }
      });
    }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Date de la réévaluation" htmlFor="rv-date"><Input id="rv-date" name="reviewed_on" type="date" required defaultValue={today} /></Field>
        <Field label="Décision" htmlFor="rv-decision">
          <Select id="rv-decision" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            {DECISIONS.map((d) => <option key={d} value={d}>{DECISION_LABELS[d]}</option>)}
          </Select>
        </Field>
        {decision !== "cloturer" ? <Field label="Prochaine réévaluation" htmlFor="rv-next"><Input id="rv-next" name="next_review_on" type="date" required /></Field> : null}
      </div>
      {objectives.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-2">Objectif</th><th className="pr-2">Valeur mesurée</th><th className="pr-2">Résultat</th><th>Commentaire</th></tr></thead>
            <tbody>
              {objectives.map((o, i) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="py-2 pr-2"><span className="font-medium">{i + 1}. {o.label}</span><br /><span className="text-xs text-muted-foreground">Cible {fr(o.target)}{o.unit ?? ""}{measures[o.id]?.n ? ` · mesure actuelle ${fr(measures[o.id].mean)}/100` : ""}</span></td>
                  <td className="py-2 pr-2"><Input aria-label={`Valeur mesurée ${i + 1}`} name={`val-${o.id}`} inputMode="decimal" className="h-9 w-24" defaultValue={measures[o.id]?.n ? fr(measures[o.id].mean) : ""} /></td>
                  <td className="py-2 pr-2">
                    <Select aria-label={`Résultat ${i + 1}`} name={`st-${o.id}`} className="h-9" defaultValue={o.status}>
                      {OBJ_STATUSES.map((s) => <option key={s} value={s}>{OBJ_STATUS_LABELS[s]}</option>)}
                    </Select>
                  </td>
                  <td className="py-2"><Input aria-label={`Commentaire ${i + 1}`} name={`com-${o.id}`} className="h-9" maxLength={500} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-muted-foreground">Aucun objectif à réévaluer.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Faits constatés" htmlFor="rv-facts"><Textarea id="rv-facts" name="facts" rows={3} maxLength={3000} placeholder="Ex. 3 passes longues réussies sur 5 en moyenne sur les 4 derniers matchs." /></Field>
        <Field label="Interprétation du staff" htmlFor="rv-interp"><Textarea id="rv-interp" name="interpretation" rows={3} maxLength={3000} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la réévaluation"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
        {err ? <p role="alert" className="text-sm text-danger">{err}</p> : null}
      </div>
    </form>
  );
}

export function DeleteReviewButton({ id }: { id: string }) {
  return <ConfirmButton label={<><Trash2 />Supprimer</>} confirmLabel="Supprimer définitivement" onConfirm={() => deleteReview(id)} />;
}
