"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import { createScouting, deleteScouting, updateScouting } from "@/lib/tactics/scouting-actions";

import { FACT_FIELDS, READING_FIELDS, SOURCE_LABELS } from "./scouting-labels";
export { FACT_FIELDS, READING_FIELDS, SOURCE_LABELS };

type Opt = { id: string; label: string };

export function NewScoutingForm({ opponentId, matches, today }: { opponentId: string; matches: (Opt & { date: string })[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus />Nouvelle fiche d&apos;observation</Button>;
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" aria-label="Nouvelle fiche d'observation" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => { const r = await createScouting(opponentId, fd); if (r?.error) setErr(r.error); });
    }}>
      <Field label="Match observé (facultatif)" htmlFor="s-match">
        <Select id="s-match" name="match_id" defaultValue="" onChange={(e) => { const m = matches.find((x) => x.id === e.target.value); if (m) setDate(m.date); }}>
          <option value="">— Autre match de l&apos;adversaire —</option>
          {matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </Select>
      </Field>
      <Field label="Date de l'observation" htmlFor="s-date"><Input id="s-date" name="observed_on" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Source" htmlFor="s-source">
        <Select id="s-source" name="source" defaultValue="video">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer la fiche"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      {err ? <p role="alert" className="w-full text-sm text-danger">{err}</p> : null}
    </form>
  );
}

export type Scouting = {
  id: string; observed_on: string; source: string; source_detail: string | null; usual_system: string | null; match_label: string | null; author: string | null;
} & Record<(typeof FACT_FIELDS)[number]["key"] | (typeof READING_FIELDS)[number]["key"], string | null>;

export function ScoutingCard({ s, editable }: { s: Scouting; editable: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const save = useAutosave<Record<string, string | null>>(async (patch) => {
    const r = await updateScouting(s.id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  const area = (key: string, label: string, hint?: string) => (
    <label key={key} className="block text-sm font-medium">{label}
      {editable ? <Textarea rows={3} maxLength={3000} defaultValue={s[key as keyof Scouting] ?? ""} placeholder={hint} onChange={(e) => save.queue({ [key]: e.target.value })} className="mt-1 font-normal" />
        : <p className="mt-1 whitespace-pre-line font-normal text-muted-foreground">{s[key as keyof Scouting] || "—"}</p>}
    </label>
  );
  return (
    <article id={`fiche-${s.id}`} className="scroll-mt-20 rounded-xl border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold uppercase">Observation du {s.observed_on.split("-").reverse().join("/")}</h3>
          <p className="text-xs text-muted-foreground">{SOURCE_LABELS[s.source]}{s.match_label ? ` · ${s.match_label}` : ""}{s.author ? ` · par ${s.author}` : ""}</p>
        </div>
        {editable ? <SaveIndicator state={save.state} /> : null}
      </header>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Système habituel
          {editable ? <Input maxLength={40} defaultValue={s.usual_system ?? ""} placeholder="Ex. 4-4-2" onChange={(e) => save.queue({ usual_system: e.target.value })} className="mt-1 font-normal" />
            : <p className="mt-1 font-normal text-muted-foreground">{s.usual_system || "—"}</p>}
        </label>
        <label className="block text-sm font-medium">Précision sur la source
          {editable ? <Input maxLength={300} defaultValue={s.source_detail ?? ""} placeholder="Ex. vidéo du match contre l'ASEC, 2e mi-temps" onChange={(e) => save.queue({ source_detail: e.target.value })} className="mt-1 font-normal" />
            : <p className="mt-1 font-normal text-muted-foreground">{s.source_detail || "—"}</p>}
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Faits observés" className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Faits observés</h4>
          {FACT_FIELDS.map((f) => area(f.key, f.label, f.hint))}
        </section>
        <section aria-label="Lecture du staff" className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lecture du staff (interprétation)</h4>
          {READING_FIELDS.map((f) => area(f.key, f.label))}
        </section>
      </div>
      {editable ? (
        <div className="mt-3 border-t pt-3">
          {armed ? (
            <span className="inline-flex gap-1">
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => { const r = await deleteScouting(s.id); if (!r.error) router.refresh(); })}>Supprimer définitivement</Button>
              <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Annuler</Button>
            </span>
          ) : <Button size="sm" variant="ghost" onClick={() => setArmed(true)}><Trash2 />Supprimer la fiche</Button>}
        </div>
      ) : null}
    </article>
  );
}
