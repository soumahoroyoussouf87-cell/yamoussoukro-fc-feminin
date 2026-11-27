"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createEvaluationSession, type CreateState } from "@/lib/performance/actions";

type Opt = { id: string; date: string; label: string };

export function NewEvaluationForm({ today, versionLabel, matches, sessions, initialMatch, initialSession }: {
  today: string; versionLabel: string; matches: Opt[]; sessions: Opt[]; initialMatch?: string; initialSession?: string;
}) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createEvaluationSession, undefined);
  const [context, setContext] = useState<"match" | "entrainement">(initialSession ? "entrainement" : "match");
  const [matchId, setMatchId] = useState(initialMatch ?? "");
  const [sessionId, setSessionId] = useState(initialSession ?? "");
  const linked = context === "match" ? matches.find((m) => m.id === matchId) : sessions.find((s) => s.id === sessionId);
  const [date, setDate] = useState(linked?.date ?? today);
  const [title, setTitle] = useState("");
  const autoTitle = linked ? `Évaluation ${linked.label.split(" · ").slice(1).join(" · ")}` : context === "match" ? "Évaluation de match" : "Évaluation d'entraînement";
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Contexte</legend>
        <div className="flex gap-2">
          {(["match", "entrainement"] as const).map((c) => (
            <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm focus-within:outline-2 focus-within:outline-ring ${context === c ? "border-fuchsia bg-fuchsia/10 font-semibold" : ""}`}>
              <input type="radio" name="context" value={c} checked={context === c} onChange={() => setContext(c)} className="sr-only" />
              {c === "match" ? "Compétition (50 % de la note technique)" : "Entraînement (30 %)"}
            </label>
          ))}
        </div>
      </fieldset>
      {context === "match" ? (
        <Field label="Match" htmlFor="match_id" error={fe.match_id} hint={matches.length ? undefined : "Aucun match joué cette saison : l'évaluation peut être créée sans lien."}>
          <Select id="match_id" name="match_id" value={matchId} onChange={(e) => { setMatchId(e.target.value); const m = matches.find((x) => x.id === e.target.value); if (m) setDate(m.date); }}>
            <option value="">— Sans lien avec un match enregistré —</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </Field>
      ) : (
        <Field label="Séance d'entraînement" htmlFor="training_session_id" error={fe.training_session_id}>
          <Select id="training_session_id" name="training_session_id" value={sessionId} onChange={(e) => { setSessionId(e.target.value); const s = sessions.find((x) => x.id === e.target.value); if (s) setDate(s.date); }}>
            <option value="">— Sans lien avec une fiche de séance —</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Date" htmlFor="evaluated_on" error={fe.evaluated_on}>
          <Input id="evaluated_on" name="evaluated_on" type="date" required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Titre" htmlFor="title" error={fe.title}>
          <Input id="title" name="title" required maxLength={160} value={title || autoTitle} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes (facultatif)" htmlFor="notes" error={fe.notes}>
        <Textarea id="notes" name="notes" maxLength={2000} rows={2} placeholder="Conditions particulières, terrain, météo…" />
      </Field>
      <p className="text-xs text-muted-foreground">Référentiel utilisé : <strong>{versionLabel}</strong>. Il reste attaché à cette évaluation même si une nouvelle version est publiée.</p>
      {state?.error ? <p role="alert" className="text-sm font-medium text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer l'évaluation"}</Button>
        <Button asChild variant="ghost"><Link href="/performance/evaluations">Annuler</Link></Button>
      </div>
    </form>
  );
}
