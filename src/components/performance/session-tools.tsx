"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { addPlayers, setEvaluationStatus, updateEvaluationSession } from "@/lib/performance/actions";
import { FRAMEWORK_KEYS, FRAMEWORK_KEY_LABELS, type FrameworkKey } from "@/lib/performance/engine";

export function EvalWorkflow({ id, status, canWrite, canValidate }: { id: string; status: string; canWrite: boolean; canValidate: boolean }) {
  const router = useRouter();
  return (
    <WorkflowBar
      status={status}
      canWrite={canWrite}
      canValidate={canValidate}
      validateHint="La validation est réservée à l'entraîneur principal et à la direction sportive. Une évaluation validée est verrouillée et entre dans les indices."
      onChange={async (to) => {
        const r = await setEvaluationStatus(id, to);
        if (!r.error) router.refresh();
        return r;
      }}
    />
  );
}

export function SessionMeta({ id, title, date, notes, editable }: { id: string; title: string; date: string; notes: string | null; editable: boolean }) {
  const [t, setT] = useState(title);
  const [d, setD] = useState(date);
  const [n, setN] = useState(notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  if (!editable) return notes ? <p className="mt-2 text-muted-foreground">{notes}</p> : null;
  const save = async (patch: Parameters<typeof updateEvaluationSession>[1]) => {
    const r = await updateEvaluationSession(id, patch);
    setMsg(r.error ?? "Enregistré.");
  };
  return (
    <div className="mt-2 space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">Titre
        <Input value={t} maxLength={160} onChange={(e) => setT(e.target.value)} onBlur={() => t !== title && save({ title: t })} />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">Date
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} onBlur={() => d !== date && d && save({ evaluated_on: d })} />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">Notes
        <Textarea rows={2} value={n} maxLength={2000} onChange={(e) => setN(e.target.value)} onBlur={() => n !== (notes ?? "") && save({ notes: n })} />
      </label>
      {msg ? <p role="status" className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}

type Candidate = { id: string; name: string; shirt: number | null; positionLabel: string | null; key: FrameworkKey | null; suggested: boolean };

export function AddPlayers({ sessionId, candidates, source }: { sessionId: string; candidates: Candidate[]; source: string }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, FrameworkKey | "">>(() => Object.fromEntries(candidates.map((c) => [c.id, c.key ?? ""])));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const list = useMemo(() => (showAll ? candidates : candidates.filter((c) => c.suggested)), [candidates, showAll]);
  const selected = candidates.filter((c) => checked[c.id]);
  const missing = selected.filter((c) => !keys[c.id]);

  return (
    <section className="mt-6 rounded-xl border bg-card p-4" aria-labelledby="add-players">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="add-players" className="font-display text-lg font-bold uppercase">Ajouter des joueuses</h2>
        <span className="text-xs text-muted-foreground">{showAll ? "Effectif complet" : source}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setChecked(Object.fromEntries(list.map((c) => [c.id, true])))}>Tout cocher</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setChecked({})}>Tout décocher</Button>
        {candidates.some((c) => !c.suggested) ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>{showAll ? "Seulement la sélection proposée" : "Afficher tout l'effectif"}</Button>
        ) : null}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg border p-2">
            <input id={`pick-${c.id}`} type="checkbox" className="size-4" checked={!!checked[c.id]} onChange={(e) => setChecked((x) => ({ ...x, [c.id]: e.target.checked }))} />
            <label htmlFor={`pick-${c.id}`} className="min-w-0 flex-1 truncate text-sm"><strong>{c.shirt ? `${c.shirt}. ` : ""}{c.name}</strong></label>
            <Select aria-label={`Poste occupé par ${c.name}`} value={keys[c.id]} onChange={(e) => setKeys((k) => ({ ...k, [c.id]: e.target.value as FrameworkKey }))} className="h-8 w-40 text-xs">
              <option value="">Poste à préciser</option>
              {FRAMEWORK_KEYS.map((k) => <option key={k} value={k}>{FRAMEWORK_KEY_LABELS[k]}</option>)}
            </Select>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || !selected.length || missing.length > 0} onClick={() => start(async () => {
          setErr(null);
          const r = await addPlayers(sessionId, selected.map((c) => ({ playerId: c.id, frameworkKey: keys[c.id] as FrameworkKey })));
          if (r.error) setErr(r.error);
          else { setChecked({}); router.refresh(); }
        })}>
          {pending ? "Ajout…" : `Ajouter ${selected.length || ""} joueuse${selected.length > 1 ? "s" : ""}`}
        </Button>
        {missing.length ? <span className="text-xs text-warning">Précisez le poste occupé de : {missing.map((m) => m.name).join(", ")}.</span> : null}
        {err ? <span role="alert" className="text-sm text-danger">{err}</span> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Le poste occupé détermine les critères techniques et les pondérations utilisés pour cette évaluation.</p>
    </section>
  );
}
