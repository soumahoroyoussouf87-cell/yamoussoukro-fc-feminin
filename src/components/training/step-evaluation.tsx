"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { INTENSITY_LABELS } from "@/lib/phase2/labels";
import { saveEvaluationPatch } from "@/lib/training/actions";
import { APPRECIATION_LABELS, DEFAULT_CRITERIA, scoreCriteria, suggestAppreciation, type Criterion } from "@/lib/training/evaluation";
import { cn } from "@/lib/utils";
import { SaveIndicator, useAutosave } from "./autosave";
import { AreaF, NumF, SelectF } from "./fields";
import type { StepProps } from "./types";

export function StepEvaluation({ data, perms, refresh }: StepProps) {
  const ev = data.evaluation;
  const s = data.session;
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
    ev?.criteria.length ? ev.criteria : [...DEFAULT_CRITERIA, ...s.specific_objectives.map((o) => `Objectif : ${o}`.slice(0, 80))].map((label) => ({ label, score: null })),
  );
  const [v, setV] = useState({
    appreciation: ev?.appreciation ?? "",
    intensity_observed: ev?.intensity_observed ?? "",
    actual_duration_min: ev?.actual_duration_min ?? null,
    strengths: ev?.strengths ?? "",
    improvements: ev?.improvements ?? "",
    difficulties: ev?.difficulties ?? "",
    corrections: ev?.corrections ?? "",
    next_objective: ev?.next_objective ?? "",
  });
  const [newLabel, setNewLabel] = useState("");
  const save = useAutosave((p: Record<string, unknown>) => saveEvaluationPatch(s.id, p), { onSaved: (p) => { if ("criteria" in p || "appreciation" in p) refresh(); } });
  const dis = !perms.write || s.status === "archive";
  const err = save.state.fields ?? {};
  const set = (k: keyof typeof v, val: string | number | null) => { setV((o) => ({ ...o, [k]: val ?? "" })); save.queue({ [k]: val === "" ? null : val }); };
  const setC = (next: Criterion[]) => { setCriteria(next); save.queue({ criteria: next }); };
  const score = scoreCriteria(criteria);
  const suggestion = score ? suggestAppreciation(score.pct) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="text-base">Évaluation par critères</CardTitle><CardDescription>Note de 1 (insuffisant) à 5 (excellent). « N.O. » = non observé, exclu du calcul.</CardDescription></div>
          <SaveIndicator state={save.state} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {criteria.map((c, k) => (
            <div key={k} className="flex flex-col gap-1.5 rounded-md border p-2 sm:flex-row sm:items-center">
              <Input aria-label={`Critère ${k + 1}`} className="h-8 flex-1 border-transparent px-1 font-medium" value={c.label} maxLength={80} disabled={dis}
                onChange={(e) => setC(criteria.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
              <div className="flex items-center gap-1" role="radiogroup" aria-label={`Note : ${c.label}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={c.score === n} disabled={dis}
                    onClick={() => setC(criteria.map((x, j) => (j === k ? { ...x, score: n } : x)))}
                    className={cn("size-8 rounded-md border text-sm font-bold", c.score === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{n}</button>
                ))}
                <button type="button" role="radio" aria-checked={c.score === null} disabled={dis}
                  onClick={() => setC(criteria.map((x, j) => (j === k ? { ...x, score: null } : x)))}
                  className={cn("h-8 rounded-md border px-2 text-xs font-semibold", c.score === null ? "border-foreground bg-accent" : "text-muted-foreground hover:bg-accent")}>N.O.</button>
                {!dis ? <Button type="button" variant="ghost" size="sm" aria-label={`Retirer le critère ${c.label}`} onClick={() => setC(criteria.filter((_, j) => j !== k))}><Trash2 /></Button> : null}
              </div>
            </div>
          ))}
          {!dis && criteria.length < 20 ? (
            <div className="flex gap-2">
              <Input aria-label="Nouveau critère" className="h-9" value={newLabel} maxLength={80} placeholder="Ex. Qualité des transitions" onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) { e.preventDefault(); setC([...criteria, { label: newLabel.trim(), score: null }]); setNewLabel(""); } }} />
              <Button type="button" size="sm" className="h-9" variant="outline" disabled={!newLabel.trim()} onClick={() => { setC([...criteria, { label: newLabel.trim(), score: null }]); setNewLabel(""); }}><Plus />Critère</Button>
            </div>
          ) : null}
          {err.criteria ? <p className="text-xs text-danger">{err.criteria}</p> : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Résultat</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {score ? (
              <div>
                <p className="font-display text-4xl font-bold">{score.pct} %</p>
                <p className="text-sm text-muted-foreground">{score.points}/{score.max} points · moyenne {String(score.average).replace(".", ",")}/5 · {score.observed} critère(s) noté(s){score.excluded ? `, ${score.excluded} non observé(s)` : ""}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Aucun critère noté.</p>}
            <SelectF name="appreciation" label="Appréciation générale" value={v.appreciation} empty="—" disabled={dis} onChange={(x) => set("appreciation", x)}
              options={Object.entries(APPRECIATION_LABELS).map(([value, label]) => ({ value, label }))} />
            {suggestion && suggestion !== v.appreciation && !dis ? (
              <button type="button" className="self-start text-xs font-semibold text-primary-text hover:underline" onClick={() => set("appreciation", suggestion)}>
                Proposée d&apos;après la note : <Badge variant="outline">{APPRECIATION_LABELS[suggestion]}</Badge>
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <NumF name="actual_duration_min" label="Durée réelle" suffix="min" value={v.actual_duration_min} min={1} max={300} disabled={dis} onChange={(x) => set("actual_duration_min", x)} error={err.actual_duration_min} />
              <SelectF name="intensity_observed" label="Intensité observée" value={v.intensity_observed} empty="—" disabled={dis} onChange={(x) => set("intensity_observed", x)}
                options={Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
            {ev && (ev.objectives_reached || ev.engagement) ? <p className="text-xs text-muted-foreground">Ancienne évaluation : objectifs {ev.objectives_reached ?? "—"}/5, engagement {ev.engagement ?? "—"}/5.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="xl:col-span-2">
        <CardHeader><CardTitle className="text-base">Bilan du staff</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <AreaF name="strengths" label="Points positifs" value={v.strengths} onChange={(x) => set("strengths", x)} maxLength={2000} disabled={dis} />
          <AreaF name="improvements" label="Points à améliorer" value={v.improvements} onChange={(x) => set("improvements", x)} maxLength={2000} disabled={dis} />
          <AreaF name="difficulties" label="Difficultés rencontrées" value={v.difficulties} onChange={(x) => set("difficulties", x)} maxLength={2000} disabled={dis} />
          <AreaF name="corrections" label="Corrections apportées" value={v.corrections} onChange={(x) => set("corrections", x)} maxLength={2000} disabled={dis} />
          <AreaF name="next_objective" label="Objectif de la prochaine séance" value={v.next_objective} onChange={(x) => set("next_objective", x)} maxLength={1000} disabled={dis} className="md:col-span-2" />
        </CardContent>
      </Card>
    </div>
  );
}
