"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import {
  addPrinciple, addSubprinciple, createGameDraft, deletePrinciple, deleteSubprinciple, linkExercise, publishGameVersion,
  setCompactnessTarget, unlinkExercise, updateMoment, updatePrinciple,
} from "@/lib/performance/game-actions";
import { LINE_RELATIONS, RELATION_LABELS, SITUATIONS } from "@/lib/performance/collective";
import type { GameVersionFull } from "@/lib/performance/collective-data";
import { cn } from "@/lib/utils";

type Ex = { id: string; title: string };

export function NewGameDraftForm({ fromId }: { fromId: string }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await createGameDraft(fromId, label); if (r?.error) setErr(r.error); });
    }}>
      <label className="flex-1 text-sm font-medium">Nouvelle version (copie de la version publiée)
        <Input value={label} maxLength={120} placeholder="Ex. Version 2 — pressing haut" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "…" : "Créer le brouillon"}</Button>
      {err ? <p role="alert" className="w-full text-sm text-danger">{err}</p> : null}
    </form>
  );
}

export function PublishGameButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const r = await publishGameVersion(id);
        if (r.error) setErr(r.error); else router.refresh();
      })}>{pending ? "Publication…" : "Publier cette version"}</Button>
      {err ? <span role="alert" className="text-xs font-medium text-danger">{err}</span> : null}
    </span>
  );
}

function MomentWeight({ id, weight, editable, onChange }: { id: string; weight: number; editable: boolean; onChange: (w: number) => void }) {
  const [v, setV] = useState(String(weight));
  const [err, setErr] = useState<string | null>(null);
  if (!editable) return <span className="rounded-md bg-fuchsia/15 px-2 py-0.5 text-sm font-semibold tabular-nums">{weight} %</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Input aria-label="Pondération du moment (%)" inputMode="decimal" className="h-8 w-16 text-center tabular-nums" value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={async () => {
          const n = Number(v.replace(",", "."));
          if (!Number.isFinite(n) || n < 0 || n > 100) { setErr("0 à 100"); return; }
          if (n === weight) return;
          const r = await updateMoment(id, { weight: n });
          setErr(r.error ?? null);
          if (!r.error) onChange(n);
        }} />
      <span className="text-sm">%</span>
      {err ? <span role="alert" className="text-xs text-danger">{err}</span> : null}
    </span>
  );
}

function PrincipleCard({ p, editable, exercises, open, onToggle }: { p: GameVersionFull["principles"][number]; editable: boolean; exercises: Ex[]; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [sub, setSub] = useState("");
  const [ex, setEx] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const save = useAutosave<{ label?: string; description?: string | null; expected_behaviors?: string | null; evaluation_criteria?: string | null }>(async (patch) => {
    const r = await updatePrinciple(p.id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (r.error) setErr(r.error); else router.refresh(); });
  const filled = [p.description, p.expected_behaviors, p.evaluation_criteria].filter(Boolean).length + (p.subprinciples.length ? 1 : 0) + (p.exercises.length ? 1 : 0);

  return (
    <li className="rounded-lg border bg-card">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="font-medium">{p.label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {filled ? `${filled}/5 rubriques` : "À compléter"}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3 text-sm">
          {editable ? (
            <>
              <label className="block text-xs font-medium text-muted-foreground">Intitulé
                <Input defaultValue={p.label} maxLength={120} onChange={(e) => e.target.value.trim().length >= 2 && save.queue({ label: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">Description
                <Textarea rows={2} defaultValue={p.description ?? ""} maxLength={2000} onChange={(e) => save.queue({ description: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">Comportements attendus
                <Textarea rows={3} defaultValue={p.expected_behaviors ?? ""} maxLength={3000} placeholder="Ce que l'on doit voir sur le terrain…" onChange={(e) => save.queue({ expected_behaviors: e.target.value })} />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">Critères d&apos;évaluation
                <Textarea rows={3} defaultValue={p.evaluation_criteria ?? ""} maxLength={3000} placeholder="À quoi reconnaît-on un principe maîtrisé (note 4-5) ?" onChange={(e) => save.queue({ evaluation_criteria: e.target.value })} />
              </label>
              <SaveIndicator state={save.state} />
            </>
          ) : (
            <dl className="space-y-2">
              {(["description", "expected_behaviors", "evaluation_criteria"] as const).map((k) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ description: "Description", expected_behaviors: "Comportements attendus", evaluation_criteria: "Critères d'évaluation" }[k]}</dt>
                  <dd className="whitespace-pre-line">{p[k] ?? <span className="text-muted-foreground">Non renseigné</span>}</dd>
                </div>
              ))}
            </dl>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sous-principes</p>
            {p.subprinciples.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {p.subprinciples.map((s) => (
                  <li key={s.id}>
                    {s.label}
                    {editable ? <button type="button" aria-label={`Supprimer ${s.label}`} className="ml-2 align-middle text-muted-foreground hover:text-danger" disabled={pending} onClick={() => run(() => deleteSubprinciple(s.id))}><Trash2 className="inline size-3.5" /></button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">Aucun sous-principe.</p>}
            {editable ? (
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sub.trim().length >= 2) run(async () => { const r = await addSubprinciple(p.id, sub); if (!r.error) setSub(""); return r; }); }}>
                <Input aria-label={`Nouveau sous-principe pour ${p.label}`} value={sub} maxLength={160} placeholder="Ajouter un sous-principe" onChange={(e) => setSub(e.target.value)} className="h-9" />
                <Button type="submit" size="sm" variant="outline" disabled={pending || sub.trim().length < 2}><Plus />Ajouter</Button>
              </form>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercices liés</p>
            {p.exercises.length ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {p.exercises.map((x) => (
                  <li key={x.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                    <a className="hover:underline" href={`/entrainement/exercices/${x.id}`}>{x.title}</a>
                    {editable ? <button type="button" aria-label={`Retirer ${x.title}`} className="text-muted-foreground hover:text-danger" disabled={pending} onClick={() => run(() => unlinkExercise(p.id, x.id))}>×</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">Aucun exercice lié.</p>}
            {editable && exercises.length ? (
              <div className="mt-2 flex gap-2">
                <Select aria-label={`Exercice à lier à ${p.label}`} value={ex} onChange={(e) => setEx(e.target.value)} className="h-9">
                  <option value="">Choisir un exercice de la bibliothèque</option>
                  {exercises.filter((x) => !p.exercises.some((y) => y.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </Select>
                <Button type="button" size="sm" variant="outline" disabled={pending || !ex} onClick={() => run(async () => { const r = await linkExercise(p.id, ex); if (!r.error) setEx(""); return r; })}>Lier</Button>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Séquences vidéo : disponibles avec le Video Analysis Center (Phase 4).</p>
          {editable ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deletePrinciple(p.id))}><Trash2 />Supprimer ce principe</Button> : null}
          {err ? <p role="alert" className="text-xs text-danger">{err}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

function AddPrinciple({ versionId, moment }: { versionId: string; moment: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await addPrinciple(versionId, moment, label); if (r.error) setErr(r.error); else { setLabel(""); setErr(null); router.refresh(); } });
    }}>
      <Input aria-label="Nouveau principe" value={label} maxLength={120} placeholder="Nouveau principe" onChange={(e) => setLabel(e.target.value)} className="h-9 max-w-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending || label.trim().length < 2}><Plus />Ajouter</Button>
      {err ? <span role="alert" className="text-xs text-danger">{err}</span> : null}
    </form>
  );
}

/** Projet de jeu : 5 moments, pondérations, principes détaillés. Modifiable seulement en brouillon. */
export function GameModelView({ version, editable, exercises }: { version: GameVersionFull; editable: boolean; exercises: Ex[] }) {
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(version.moments.map((m) => [m.id, m.weight])));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-4">
      {editable ? <p className={cn("text-sm", total === 100 ? "text-muted-foreground" : "font-medium text-warning")}>Total des pondérations : {total} %{total === 100 ? "" : " (100 % requis pour publier)"}</p> : null}
      {version.moments.map((m) => {
        const list = version.principles.filter((p) => p.moment === m.code);
        return (
          <section key={m.id} aria-labelledby={`m-${m.code}`} className="rounded-xl border bg-card/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`m-${m.code}`} className="font-display text-xl font-bold uppercase">{m.label} <span className="text-sm font-normal normal-case text-muted-foreground">· {list.length} principe{list.length > 1 ? "s" : ""}</span></h2>
              <MomentWeight id={m.id} weight={weights[m.id]} editable={editable} onChange={(w) => setWeights((x) => ({ ...x, [m.id]: w }))} />
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {list.map((p) => <PrincipleCard key={p.id} p={p} editable={editable} exercises={exercises} open={!!open[p.id]} onToggle={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} />)}
            </ul>
            {editable ? <AddPrinciple versionId={version.id} moment={m.code} /> : null}
          </section>
        );
      })}
    </div>
  );
}

/** Objectifs de compacité par situation : jamais imposés aux situations sans objectif. */
export function CompactnessTargets({ targets, editable }: { targets: { situation: string; relation_code: string; min_m: number; max_m: number }[]; editable: boolean }) {
  const router = useRouter();
  const key = (s: string, r: string) => `${s}|${r}`;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(targets.map((t) => [key(t.situation, t.relation_code), `${String(t.min_m).replace(".", ",")}-${String(t.max_m).replace(".", ",")}`])));
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (s: string, r: string) => {
    const raw = (vals[key(s, r)] ?? "").trim();
    if (raw === "") {
      const res = await setCompactnessTarget(s, r, null, null);
      setMsg(res.error ?? "Objectif retiré.");
    } else {
      const m = raw.replace(/,/g, ".").match(/^(\d+(?:\.\d+)?)\s*[-–à]\s*(\d+(?:\.\d+)?)$/);
      if (!m) { setMsg("Format attendu : 10-15"); return; }
      const res = await setCompactnessTarget(s, r, Number(m[1]), Number(m[2]));
      setMsg(res.error ?? "Objectif enregistré.");
    }
    router.refresh();
  };
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-medium">Situation</th>
              {LINE_RELATIONS.map((r) => <th key={r} scope="col" className="px-1 font-medium">{RELATION_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {SITUATIONS.map((s) => (
              <tr key={s.code} className="border-b last:border-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">{s.label}</th>
                {LINE_RELATIONS.map((r) => (
                  <td key={r} className="px-1 py-1">
                    {editable ? (
                      <Input aria-label={`Objectif ${s.label}, ${RELATION_LABELS[r]} (mètres)`} className="h-8 w-24 text-center tabular-nums" placeholder="—"
                        value={vals[key(s.code, r)] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [key(s.code, r)]: e.target.value }))}
                        onBlur={() => save(s.code, r)} />
                    ) : <span className="tabular-nums">{vals[key(s.code, r)] ? `${vals[key(s.code, r)]} m` : "—"}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">En mètres, sous la forme « 10-15 ». Une case vide = pas d&apos;objectif : la distance mesurée est enregistrée sans être jugée.</p>
      {msg ? <p role="status" className="mt-1 text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
