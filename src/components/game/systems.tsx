"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { PitchMarkings } from "@/components/phase2/pitch";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { FORMATIONS } from "@/lib/domain/formations";
import { createSystem, deleteSystem, setReferenceSystem, updateSystem } from "@/lib/performance/game-actions";
import { SYSTEM_PHASES, SYSTEM_PHASE_LABELS } from "@/lib/performance/collective";
import type { GameSystem } from "@/lib/performance/collective-data";
import { cn } from "@/lib/utils";

type Slot = { label: string; x: number; y: number };

/** Terrain : positions déplaçables à la souris, au doigt ou au clavier (flèches). */
export function SystemBoard({ slots, onChange, editable, size = "md", title }: { slots: Slot[]; onChange?: (s: Slot[]) => void; editable: boolean; size?: "sm" | "md"; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (i: number, x: number, y: number) => {
    const next = slots.map((s, j) => (j === i ? { ...s, x: Math.round(Math.max(3, Math.min(97, x))), y: Math.round(Math.max(3, Math.min(97, y))) } : s));
    onChange?.(next);
  };
  return (
    <div ref={ref} role="group" aria-label={title}
      className={cn("relative mx-auto aspect-[68/105] w-full touch-none select-none overflow-hidden rounded-lg", size === "sm" ? "max-w-[180px]" : "max-w-[340px]")}
      onPointerMove={(e) => {
        if (drag == null || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        move(drag, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      }}
      onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      <PitchMarkings />
      {slots.map((s, i) => (
        <button key={i} type="button" disabled={!editable}
          aria-label={`${s.label} : position ${s.x} % en largeur, ${s.y} % en hauteur${editable ? ". Flèches pour déplacer" : ""}`}
          onPointerDown={(e) => { if (!editable) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(i); }}
          onKeyDown={(e) => {
            if (!editable) return;
            const d = e.shiftKey ? 5 : 2;
            const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
            if (k) { e.preventDefault(); move(i, s.x + k[0], s.y + k[1]); }
          }}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fuchsia font-bold text-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-100",
            size === "sm" ? "size-6 text-[8px]" : "size-9 text-[11px]", editable && "cursor-grab active:cursor-grabbing")}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

function SystemCard({ s, editable, isAnimation }: { s: GameSystem; editable: boolean; isAnimation: boolean }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(s.slots);
  const [name, setName] = useState(s.name);
  const [notes, setNotes] = useState(s.notes ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = JSON.stringify(slots) !== JSON.stringify(s.slots) || name !== s.name || notes !== (s.notes ?? "");
  const run = (fn: () => Promise<{ error?: string }>, ok?: string) => start(async () => { const r = await fn(); setMsg(r.error ?? ok ?? null); if (!r.error) router.refresh(); });
  return (
    <article className="rounded-xl border bg-card p-3">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{SYSTEM_PHASE_LABELS[s.phase]} · base {s.base}</p>
          {editable ? <Input aria-label="Nom du système" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 font-semibold" />
            : <h3 className="font-semibold">{s.name}</h3>}
        </div>
        {s.is_reference ? <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia/15 px-2 py-0.5 text-xs font-semibold"><Star className="size-3" aria-hidden />Système du club</span> : null}
      </header>
      <SystemBoard slots={slots} onChange={setSlots} editable={editable} size={isAnimation ? "sm" : "md"} title={`Placement ${s.name}`} />
      {editable ? (
        <>
          <ul className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6" aria-label="Libellés des postes">
            {slots.map((x, i) => (
              <li key={i}><Input aria-label={`Libellé du poste ${i + 1}`} value={x.label} maxLength={6} className="h-7 px-1 text-center text-xs"
                onChange={(e) => setSlots(slots.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} /></li>
            ))}
          </ul>
          <Textarea aria-label="Notes" rows={2} value={notes} maxLength={2000} placeholder="Principes d'animation, rôles, déclencheurs…" className="mt-2" onChange={(e) => setNotes(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!dirty || pending || slots.some((x) => !x.label.trim())} onClick={() => run(() => updateSystem(s.id, { name, slots, notes }), "Enregistré.")}>Enregistrer</Button>
            {!isAnimation && !s.is_reference ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => setReferenceSystem(s.id))}><Star />Système du club</Button> : null}
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteSystem(s.id))}><Trash2 />Supprimer</Button>
          </div>
          {msg ? <p role="status" className="mt-1 text-xs text-muted-foreground">{msg}</p> : null}
        </>
      ) : s.notes ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{s.notes}</p> : null}
    </article>
  );
}

function NewAnimation({ parent }: { parent: GameSystem }) {
  const router = useRouter();
  const [phase, setPhase] = useState("possession");
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const slots = base && FORMATIONS[base] ? FORMATIONS[base] : parent.slots;
        const r = await createSystem({ name: name || `${parent.name} · ${SYSTEM_PHASE_LABELS[phase]}`, base: base || parent.base, phase, parent_id: parent.id, slots, notes: null });
        if (r.error) setErr(r.error); else { setName(""); setErr(null); router.refresh(); }
      });
    }}>
      <label className="text-xs font-medium text-muted-foreground">Phase
        <Select value={phase} onChange={(e) => setPhase(e.target.value)} className="h-9">
          {SYSTEM_PHASES.filter((p) => p.code !== "reference").map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        </Select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">Partir de
        <Select value={base} onChange={(e) => setBase(e.target.value)} className="h-9">
          <option value="">Placement du système de référence</option>
          {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      </label>
      <label className="min-w-48 flex-1 text-xs font-medium text-muted-foreground">Nom
        <Input value={name} maxLength={80} placeholder="Ex. 3-2-5 en possession" onChange={(e) => setName(e.target.value)} className="h-9" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>Ajouter l&apos;animation</Button>
      {err ? <p role="alert" className="w-full text-xs text-danger">{err}</p> : null}
    </form>
  );
}

export function NewSystemForm() {
  const router = useRouter();
  const [base, setBase] = useState("4-3-3");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createSystem({ name: name || `${base} de référence`, base, phase: "reference", parent_id: null, slots: FORMATIONS[base], notes: null });
        if (r.error) setErr(r.error); else { setName(""); setErr(null); router.refresh(); }
      });
    }}>
      <label className="text-sm font-medium">Système
        <Select value={base} onChange={(e) => setBase(e.target.value)}>
          {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      </label>
      <label className="min-w-56 flex-1 text-sm font-medium">Nom (facultatif)
        <Input value={name} maxLength={80} placeholder={`${base} de référence`} onChange={(e) => setName(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "…" : "Créer le système"}</Button>
      {err ? <p role="alert" className="w-full text-sm text-danger">{err}</p> : null}
      <p className="w-full text-xs text-muted-foreground">Pour un système personnalisé, partez du plus proche puis déplacez les joueuses sur le terrain.</p>
    </form>
  );
}

export function SystemsList({ systems, editable }: { systems: GameSystem[]; editable: boolean }) {
  const refs = systems.filter((s) => !s.parent_id).sort((a, b) => Number(b.is_reference) - Number(a.is_reference));
  return (
    <div className="space-y-6">
      {refs.map((r) => {
        const anims = systems.filter((s) => s.parent_id === r.id);
        return (
          <section key={r.id} aria-label={r.name} className="rounded-2xl border bg-card/40 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <SystemCard s={r} editable={editable} isAnimation={false} />
              <div>
                <h3 className="mb-2 font-display text-lg font-bold uppercase">Animations ({anims.length})</h3>
                {anims.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {anims.map((a) => <SystemCard key={a.id} s={a} editable={editable} isAnimation />)}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Aucune animation : ajoutez le placement en possession, hors possession ou en transition.</p>}
                {editable ? <NewAnimation parent={r} /> : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
