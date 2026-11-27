"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Select } from "@/components/ui/form";
import { BLOCK_LABELS, CATEGORY_LABELS } from "@/lib/phase2/labels";
import { addItem, addPhase, deletePhase, quickCreateExercise, removeItem, saveLayout, updateItem, updatePhase } from "@/lib/training/actions";
import { clockAt, computeSchedule, fmtMin, plannedMinutes } from "@/lib/training/schedule";
import type { SheetItem, SheetPhase } from "@/lib/training/sheet-types";
import { cn } from "@/lib/utils";
import { SaveIndicator, useAutosave } from "./autosave";
import type { StepProps } from "./types";

const structureKey = (phases: SheetPhase[]) => phases.map((p) => `${p.id}:${p.items.map((i) => i.id).join(",")}`).join("|");
type Drag = { kind: "phase"; id: string } | { kind: "item"; id: string; from: string } | null;

export function StepBuild({ data, perms, library, refresh }: StepProps) {
  const s = data.session;
  const [phases, setPhases] = useState<SheetPhase[]>(data.phases);
  const key = structureKey(data.phases);
  const lastKey = useRef(key);
  useEffect(() => {
    if (key !== lastKey.current) { lastKey.current = key; setPhases(data.phases); }
  }, [key, data.phases]);

  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const drag = useRef<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const dis = !perms.editable;

  const sched = useMemo(() => computeSchedule(phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items }))), [phases]);
  const planned = plannedMinutes(s.starts_at, s.ends_at);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Action refusée.");
      refresh();
    });

  const persist = (next: SheetPhase[]) => {
    setPhases(next);
    lastKey.current = structureKey(next);
    run(() => saveLayout(s.id, next.map((p) => ({ id: p.id, items: p.items.map((i) => i.id) }))));
  };

  const movePhase = (id: string, to: number) => {
    const from = phases.findIndex((p) => p.id === id);
    if (from < 0 || to < 0 || to >= phases.length || from === to) return;
    const next = [...phases];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p);
    persist(next);
  };
  const moveItem = (itemId: string, toPhase: string, toIndex: number) => {
    const next = phases.map((p) => ({ ...p, items: [...p.items] }));
    let moved: SheetItem | undefined;
    for (const p of next) {
      const k = p.items.findIndex((i) => i.id === itemId);
      if (k >= 0) { [moved] = p.items.splice(k, 1); if (p.id === toPhase && k < toIndex) toIndex--; }
    }
    const target = next.find((p) => p.id === toPhase);
    if (!moved || !target) return;
    target.items.splice(Math.max(0, Math.min(toIndex, target.items.length)), 0, moved);
    persist(next);
  };
  const patchItem = (itemId: string, patch: Partial<SheetItem>) =>
    setPhases((ps) => ps.map((p) => ({ ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })));
  const patchPhase = (id: string, patch: Partial<SheetPhase>) => setPhases((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const onDrop = (phaseId: string, index: number) => {
    const d = drag.current;
    drag.current = null;
    setOver(null);
    if (!d) return;
    if (d.kind === "item") moveItem(d.id, phaseId, index);
    else movePhase(d.id, phases.findIndex((p) => p.id === phaseId));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-3">
        {error ? <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
        {phases.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">Aucune phase. Commence par ajouter une phase (ex. Activation, Échauffement, Jeu dirigé…).</Card> : null}
        {phases.map((p, pi) => {
          const t = sched.phases[pi];
          return (
            <Card
              key={p.id}
              className={cn("transition-shadow", over === `phase:${p.id}` && "ring-2 ring-primary")}
              onDragOver={(e) => { if (drag.current) { e.preventDefault(); setOver(`phase:${p.id}`); } }}
              onDragLeave={() => setOver((o) => (o === `phase:${p.id}` ? null : o))}
              onDrop={(e) => { e.preventDefault(); onDrop(p.id, p.items.length); }}
            >
              <PhaseHeader
                phase={p} index={pi} count={phases.length} disabled={dis} start={clockAt(s.starts_at, t?.start ?? 0)} end={clockAt(s.starts_at, t?.end ?? 0)} total={t?.total ?? 0}
                onDragStart={() => { drag.current = { kind: "phase", id: p.id }; }}
                onMove={(dir) => movePhase(p.id, pi + dir)}
                onPatch={(patch) => patchPhase(p.id, patch)}
                onDelete={() => run(() => deletePhase(p.id))}
              />
              <CardContent className="flex flex-col gap-2">
                {p.items.length === 0 ? <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">{dis ? "Aucun exercice." : "Glisse un exercice ici ou ajoute-le ci-dessous."}</p> : null}
                {p.items.map((i, ii) => (
                  <div
                    key={i.id}
                    onDragOver={(e) => { if (drag.current?.kind === "item") { e.preventDefault(); e.stopPropagation(); setOver(`item:${i.id}`); } }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(p.id, ii); }}
                    className={cn(over === `item:${i.id}` && "border-t-4 border-primary pt-1")}
                  >
                    <ItemRow
                      item={i} disabled={dis} timing={t?.items[ii]} startsAt={s.starts_at}
                      canUp={ii > 0 || pi > 0} canDown={ii < p.items.length - 1 || pi < phases.length - 1}
                      onDragStart={() => { drag.current = { kind: "item", id: i.id, from: p.id }; }}
                      onMove={(dir) => {
                        if (dir === -1) {
                          if (ii > 0) moveItem(i.id, p.id, ii - 1);
                          else moveItem(i.id, phases[pi - 1].id, phases[pi - 1].items.length);
                        } else if (ii < p.items.length - 1) moveItem(i.id, p.id, ii + 2);
                        else moveItem(i.id, phases[pi + 1].id, 0);
                      }}
                      onPatch={(patch) => patchItem(i.id, patch)}
                      onRemove={() => run(() => removeItem(i.id))}
                    />
                  </div>
                ))}
                {!dis ? <AddExercise library={library} pending={pending} onAdd={(exerciseId) => run(() => addItem(s.id, p.id, exerciseId))}
                  onCreate={(title, category) => run(async () => { const r = await quickCreateExercise(title, category); return r.ok ? addItem(s.id, p.id, r.id) : r; })} /> : null}
              </CardContent>
            </Card>
          );
        })}
        {!dis ? <AddPhase pending={pending} onAdd={(title, block) => run(() => addPhase(s.id, title, block))} /> : null}
      </div>

      <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <CardHeader><CardTitle className="text-base">Déroulé calculé</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row k="Durée totale" v={fmtMin(sched.total)} strong />
            <Row k="Travail effectif" v={fmtMin(sched.work)} />
            <Row k="Récupérations" v={fmtMin(sched.recovery)} />
            <Row k="Pauses / transitions" v={fmtMin(sched.pauses)} />
            <Row k="Horaire prévu" v={planned ? fmtMin(planned) : "Non renseigné"} />
            {s.starts_at ? <Row k="Fin calculée" v={clockAt(s.starts_at, sched.total) ?? "—"} /> : null}
            {planned && sched.total > planned ? (
              <p className="flex gap-2 rounded-md bg-warning/10 p-2 text-xs font-medium text-warning"><AlertTriangle className="size-4 shrink-0" aria-hidden />Le contenu dépasse l&apos;horaire de {fmtMin(sched.total - planned)}.</p>
            ) : null}
            {planned && sched.total > 0 && sched.total < planned ? <p className="text-xs text-muted-foreground">Temps libre restant : {fmtMin(planned - sched.total)}.</p> : null}
            <p className="text-xs text-muted-foreground">Durée d&apos;un exercice = séries × durée + récupérations entre séries + pause après l&apos;exercice.</p>
          </CardContent>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Glisse-dépose les phases et les exercices pour réorganiser (sur téléphone, utilise les flèches). Le contenu pédagogique et les schémas se complètent à l&apos;étape 4.
        </Card>
      </aside>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className={cn(strong && "font-display text-lg font-bold")}>{v}</span></div>;
}

function PhaseHeader({ phase, index, count, disabled, start, end, total, onDragStart, onMove, onPatch, onDelete }: {
  phase: SheetPhase; index: number; count: number; disabled: boolean; start: string | null; end: string | null; total: number;
  onDragStart: () => void; onMove: (dir: -1 | 1) => void; onPatch: (p: Partial<SheetPhase>) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { state, queue } = useAutosave((p: Record<string, unknown>) => updatePhase(phase.id, p));
  return (
    <CardHeader className="gap-2 border-b pb-3">
      <div className="flex flex-wrap items-center gap-2">
        {!disabled ? (
          <span draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }} className="cursor-grab text-muted-foreground" title="Glisser pour déplacer la phase">
            <GripVertical className="size-4" aria-hidden />
          </span>
        ) : null}
        <span className="font-display text-lg font-bold text-primary-text">{index + 1}</span>
        <CardTitle className="flex-1 text-base">{phase.title}</CardTitle>
        {phase.block ? <Badge variant="outline">{BLOCK_LABELS[phase.block]}</Badge> : null}
        <span className="text-xs font-semibold tabular-nums">{start && end ? `${start} → ${end} · ` : ""}{fmtMin(total)}</span>
        {!disabled ? (
          <span className="flex items-center">
            <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Monter la phase"><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Descendre la phase"><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-label="Modifier la phase" aria-expanded={editing}><Pencil /></Button>
          </span>
        ) : null}
      </div>
      {phase.notes && !editing ? <CardDescription>{phase.notes}</CardDescription> : null}
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Titre de la phase" htmlFor={`pt-${phase.id}`}>
            <Input id={`pt-${phase.id}`} defaultValue={phase.title} maxLength={120} onChange={(e) => { if (e.target.value.trim().length >= 2) { onPatch({ title: e.target.value }); queue({ title: e.target.value }); } }} />
          </Field>
          <Field label="Durée (sans exercice)" htmlFor={`pd-${phase.id}`} hint="Ex. causerie">
            <Input id={`pd-${phase.id}`} type="number" min={1} max={180} defaultValue={phase.duration_min ?? ""} disabled={phase.items.length > 0}
              onChange={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); onPatch({ duration_min: v }); queue({ duration_min: v }); }} />
          </Field>
          <Field label="Notes de la phase" htmlFor={`pn-${phase.id}`} className="sm:col-span-2">
            <Input id={`pn-${phase.id}`} defaultValue={phase.notes ?? ""} maxLength={1000} onChange={(e) => { onPatch({ notes: e.target.value || null }); queue({ notes: e.target.value }); }} />
          </Field>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <SaveIndicator state={state} />
            <ConfirmButton label={<><Trash2 />Supprimer la phase</>} confirmLabel={phase.items.length ? `Supprimer avec ${phase.items.length} exercice(s)` : "Supprimer"} onConfirm={async () => onDelete()} />
          </div>
        </div>
      ) : null}
    </CardHeader>
  );
}

function ItemRow({ item, disabled, timing, startsAt, canUp, canDown, onDragStart, onMove, onPatch, onRemove }: {
  item: SheetItem; disabled: boolean; timing?: { start: number; end: number; total: number }; startsAt: string | null; canUp: boolean; canDown: boolean;
  onDragStart: () => void; onMove: (dir: -1 | 1) => void; onPatch: (p: Partial<SheetItem>) => void; onRemove: () => void;
}) {
  const { state, queue } = useAutosave((p: Record<string, unknown>) => updateItem(item.id, p));
  const num = (k: "duration_min" | "series" | "recovery_sec" | "pause_after_min") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === "" ? null : Math.round(Number(e.target.value));
    onPatch({ [k]: v });
    queue({ [k]: v });
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-2.5">
      <div className="flex items-start gap-2">
        {!disabled ? (
          <span draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; onDragStart(); }} className="mt-0.5 cursor-grab text-muted-foreground" title="Glisser pour déplacer l'exercice">
            <GripVertical className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{item.exercise.title}</p>
          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.exercise.category]}{timing && startsAt ? ` · ${clockAt(startsAt, timing.start)} → ${clockAt(startsAt, timing.end)}` : ""} · {fmtMin(timing?.total ?? 0)}</p>
        </div>
        <SaveIndicator state={state} />
        {!disabled ? (
          <span className="flex items-center">
            <Button type="button" variant="ghost" size="sm" disabled={!canUp} onClick={() => onMove(-1)} aria-label="Monter l'exercice"><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="sm" disabled={!canDown} onClick={() => onMove(1)} aria-label="Descendre l'exercice"><ArrowDown /></Button>
            <ConfirmButton label={<Trash2 aria-label="Retirer l'exercice" />} confirmLabel="Retirer" onConfirm={async () => onRemove()} />
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniNum id={`d-${item.id}`} label="Durée / série (min)" value={item.duration_min} min={1} max={180} disabled={disabled} onChange={num("duration_min")} />
        <MiniNum id={`s-${item.id}`} label="Séries" value={item.series} min={1} max={50} disabled={disabled} onChange={num("series")} />
        <MiniNum id={`r-${item.id}`} label="Récup. entre séries (s)" value={item.recovery_sec} min={0} max={1800} step={15} disabled={disabled} onChange={num("recovery_sec")} />
        <MiniNum id={`p-${item.id}`} label="Pause après (min)" value={item.pause_after_min} min={0} max={60} disabled={disabled} onChange={num("pause_after_min")} />
      </div>
      {state.fields ? <p className="text-xs text-danger">{Object.values(state.fields)[0]}</p> : null}
      <Link href="?etape=4" scroll={false} className="self-start text-xs font-semibold text-primary-text hover:underline">Contenu pédagogique et schéma →</Link>
    </div>
  );
}

function MiniNum({ id, label, value, onChange, ...rest }: { id: string; label: string; value: number | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; min: number; max: number; step?: number; disabled: boolean }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      {label}
      <Input id={id} type="number" inputMode="numeric" className="h-9" defaultValue={value ?? ""} onChange={onChange} {...rest} />
    </label>
  );
}

function AddPhase({ pending, onAdd }: { pending: boolean; onAdd: (title: string, block: string | null) => void }) {
  const [block, setBlock] = useState("");
  const [title, setTitle] = useState("");
  return (
    <Card className="border-dashed">
      <CardContent className="grid gap-3 pt-5 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <Field label="Type de phase" htmlFor="new-phase-block">
          <Select id="new-phase-block" value={block} onChange={(e) => { setBlock(e.target.value); if (e.target.value && !title) setTitle(BLOCK_LABELS[e.target.value]); }}>
            <option value="">Libre</option>
            {Object.entries(BLOCK_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Titre de la phase" htmlFor="new-phase-title">
          <Input id="new-phase-title" value={title} maxLength={120} placeholder="Ex. Activation athlétique, Causerie…" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Button type="button" disabled={pending || title.trim().length < 2} onClick={() => { onAdd(title.trim(), block || null); setTitle(""); setBlock(""); }}><Plus />Ajouter la phase</Button>
      </CardContent>
    </Card>
  );
}

function AddExercise({ library, pending, onAdd, onCreate }: { library: StepProps["library"]; pending: boolean; onAdd: (id: string) => void; onCreate: (title: string, category: string) => void }) {
  const [mode, setMode] = useState<"pick" | "new">(library.length ? "pick" : "new");
  const [pick, setPick] = useState("");
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("");
  const groups = Object.entries(CATEGORY_LABELS).map(([c, l]) => ({ c, l, items: library.filter((e) => e.category === c) })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-2">
      <div className="flex gap-1 text-xs">
        <button type="button" className={cn("rounded px-2 py-1 font-semibold", mode === "pick" ? "bg-accent" : "text-muted-foreground")} onClick={() => setMode("pick")} disabled={!library.length}>Depuis la bibliothèque</button>
        <button type="button" className={cn("rounded px-2 py-1 font-semibold", mode === "new" ? "bg-accent" : "text-muted-foreground")} onClick={() => setMode("new")}>Nouvel exercice</button>
      </div>
      {mode === "pick" ? (
        <div className="flex gap-2">
          <Select aria-label="Exercice de la bibliothèque" value={pick} onChange={(e) => setPick(e.target.value)} className="h-9">
            <option value="">Choisir un exercice…</option>
            {groups.map((g) => <optgroup key={g.c} label={g.l}>{g.items.map((e) => <option key={e.id} value={e.id}>{e.title}{e.duration_min ? ` (${e.duration_min} min)` : ""}</option>)}</optgroup>)}
          </Select>
          <Button type="button" size="sm" className="h-9" disabled={!pick || pending} onClick={() => { onAdd(pick); setPick(""); }}><Plus />Ajouter</Button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <Input aria-label="Titre du nouvel exercice" className="h-9" value={title} maxLength={120} placeholder="Titre de l'exercice" onChange={(e) => setTitle(e.target.value)} />
          <Select aria-label="Catégorie" className="h-9" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Catégorie…</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Button type="button" size="sm" className="h-9" disabled={title.trim().length < 2 || !cat || pending} onClick={() => { onCreate(title.trim(), cat); setTitle(""); }}><Plus />Créer et ajouter</Button>
        </div>
      )}
    </div>
  );
}
