"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Copy, Download, FileJson, Hand, Image as ImageIcon, MousePointer2, Pause, Play, Plus, Printer, Redo2, Ruler, Save, Square, Circle as CircleIcon, Trash2, Type, Undo2, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import {
  ARROW_LABELS, EQUIP_LABELS, PALETTE, PITCH_LABELS, TEAM_COLORS, emptyDiagram, itemShapes, isPointItem, newId, parseDiagram, pitchShapes, pitchSize, posAt, diagramSvg, sortedItems,
  type ArrowKind, type Diagram, type EquipKind, type Item, type PitchKind, type PitchStyle, type Pt, type Team,
} from "@/lib/training/diagram";
import { cn } from "@/lib/utils";
import { Shapes } from "./shape-svg";
import { downloadBlob, slug, svgToBlob } from "./raster";

type Tool =
  | { t: "select" }
  | { t: "player"; team: Team }
  | { t: "equip"; kind: EquipKind }
  | { t: "arrow"; kind: ArrowKind }
  | { t: "zone"; shape: "rect" | "ellipse" }
  | { t: "text" }
  | { t: "dim" };

type DragState =
  | { mode: "move"; id: string; start: Pt; orig: Item; origPos: Pt | null }
  | { mode: "handle"; id: string; handle: "from" | "to" | "ctrl" | "size" }
  | { mode: "draw"; id: string; start: Pt }
  | null;

export type SaveMode = "update" | "copy";

type Props = {
  initial: Diagram | null;
  title: string;
  readOnly?: boolean;
  /** Enregistre le schéma ; « copy » crée un nouveau schéma. */
  onSave?: (title: string, data: Diagram, mode: SaveMode) => Promise<{ ok: boolean; error?: string }>;
  canCopy?: boolean;
  saveHint?: string;
  onClose?: () => void;
  /** Effectif du club : permet d'afficher le nom d'une joueuse sous son pion. */
  roster?: RosterEntry[];
  /** Lien vers la version imprimable (PDF, toutes les étapes). */
  printHref?: string;
};

export type RosterEntry = { id: string; name: string; number: number | null };

const HISTORY = 60;
const clone = (d: Diagram): Diagram => JSON.parse(JSON.stringify(d));

export function TacticalBoard({ initial, title: initialTitle, readOnly = false, onSave, canCopy = false, saveHint, onClose, roster, printHref }: Props) {
  const [doc, setDoc] = useState<Diagram>(() => (initial ? clone(initial) : emptyDiagram("half")));
  const [title, setTitle] = useState(initialTitle);
  const [tool, setTool] = useState<Tool>({ t: "select" });
  const [sel, setSel] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [play, setPlay] = useState<{ frame: number; t: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const past = useRef<Diagram[]>([]);
  const future = useRef<Diagram[]>([]);
  const drag = useRef<DragState>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { w, h } = pitchSize(doc.pitch.kind);
  const selected = doc.items.find((i) => i.id === sel) ?? null;

  const docRef = useRef(doc);
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const syncHist = useCallback(() => setHist({ past: past.current.length, future: future.current.length }), []);
  const show = useCallback((d: Diagram) => { docRef.current = d; setDoc(d); }, []);

  /** Applique une modification en l'ajoutant à l'historique (annuler / rétablir). */
  const commit = useCallback((fn: (d: Diagram) => Diagram, record = true) => {
    const cur = docRef.current;
    if (record) { past.current = [...past.current.slice(-HISTORY), cur]; future.current = []; }
    show(fn(clone(cur)));
    setDirty(true);
    if (record) syncHist();
  }, [show, syncHist]);
  const snapshot = useCallback(() => {
    past.current = [...past.current.slice(-HISTORY), clone(docRef.current)];
    future.current = [];
    syncHist();
  }, [syncHist]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(docRef.current);
    show(prev);
    setDirty(true);
    syncHist();
  }, [show, syncHist]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(docRef.current);
    show(next);
    setDirty(true);
    syncHist();
  }, [show, syncHist]);

  const removeSel = useCallback(() => {
    if (!sel) return;
    commit((d) => ({ ...d, items: d.items.filter((i) => i.id !== sel), frames: d.frames.map((f) => { const pos = { ...f.pos }; delete pos[sel]; return { ...f, pos }; }) }));
    setSel(null);
  }, [sel, commit]);
  const duplicateSel = useCallback(() => {
    if (!selected) return;
    const id = newId();
    const off = (p: Pt) => ({ x: p.x + 25, y: p.y + 25 });
    const copy: Item = "from" in selected ? { ...selected, id, from: off(selected.from), to: off(selected.to), ...(selected.type === "arrow" && selected.ctrl ? { ctrl: off(selected.ctrl) } : {}) } : { ...selected, id, x: selected.x + 25, y: selected.y + 25 } as Item;
    commit((d) => ({ ...d, items: [...d.items, copy] }));
    setSel(id);
  }, [selected, commit]);

  // Raccourcis clavier.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (sel) { e.preventDefault(); removeSel(); } }
      else if (e.key === "Escape") { setSel(null); setTool({ t: "select" }); }
      else if (sel && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 5;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit((d) => moveItem(d, sel, dx, dy, frame));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, sel, frame, undo, redo, duplicateSel, removeSel, commit]);

  // Lecture de l'animation entre les étapes.
  useEffect(() => {
    if (!play) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlay((p) => {
        if (!p) return p;
        let t = p.t + dt / 1.2;
        let f = p.frame;
        if (t >= 1) { t = 0; f += 1; }
        if (f >= doc.frames.length - 1) { setFrame(doc.frames.length - 1); return null; }
        return { frame: f, t };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, doc.frames.length]);

  const toLocal = (e: React.PointerEvent | PointerEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.round(Math.max(0, Math.min(w, p.x))), y: Math.round(Math.max(0, Math.min(h, p.y))) };
  };

  const nextLabel = (team: Team) => {
    if (team === "gk") return "GB";
    const used = doc.items.filter((i) => i.type === "player" && i.team === team).map((i) => Number((i as { label: string }).label)).filter((n) => !Number.isNaN(n));
    let n = 1;
    while (used.includes(n)) n++;
    return String(n);
  };

  const onBoardDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || play) return;
    const p = toLocal(e);
    if (tool.t === "select") { setSel(null); return; }
    const id = newId();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool.t === "player") { commit((d) => ({ ...d, items: [...d.items, { id, type: "player", x: p.x, y: p.y, team: tool.team, label: nextLabel(tool.team) }] })); setSel(id); return; }
    if (tool.t === "equip") { commit((d) => ({ ...d, items: [...d.items, { id, type: tool.kind, x: p.x, y: p.y }] })); setSel(id); return; }
    if (tool.t === "text") { commit((d) => ({ ...d, items: [...d.items, { id, type: "text", x: p.x, y: p.y, text: "Texte", size: 22, color: "#ffffff" }] })); setSel(id); setTool({ t: "select" }); return; }
    if (tool.t === "arrow") commit((d) => ({ ...d, items: [...d.items, { id, type: "arrow", kind: tool.kind, from: p, to: { x: p.x + 1, y: p.y + 1 } }] }));
    if (tool.t === "dim") commit((d) => ({ ...d, items: [...d.items, { id, type: "dim", from: p, to: { x: p.x + 1, y: p.y }, label: "" }] }));
    if (tool.t === "zone") commit((d) => ({ ...d, items: [...d.items, { id, type: "zone", shape: tool.shape, x: p.x, y: p.y, w: 1, h: 1, color: "#facc15", hatch: false }] }));
    drag.current = { mode: "draw", id, start: p };
    setSel(id);
  };

  const onItemDown = (e: React.PointerEvent, it: Item) => {
    if (readOnly || play || tool.t !== "select") return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setSel(it.id);
    const p = toLocal(e);
    snapshot();
    drag.current = { mode: "move", id: it.id, start: p, orig: JSON.parse(JSON.stringify(it)), origPos: isPointItem(it) ? posAt(doc, it, frame) : null };
  };
  const onHandleDown = (e: React.PointerEvent, id: string, handle: "from" | "to" | "ctrl" | "size") => {
    if (readOnly) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    snapshot();
    drag.current = { mode: "handle", id, handle };
  };

  const onMove = (e: React.PointerEvent) => {
    const d0 = drag.current;
    if (!d0) return;
    const p = toLocal(e);
    if (d0.mode === "draw") {
      commit((d) => ({
        ...d,
        items: d.items.map((i) => {
          if (i.id !== d0.id) return i;
          if (i.type === "arrow" || i.type === "dim") return { ...i, to: p };
          if (i.type === "zone") return { ...i, x: Math.min(p.x, d0.start.x), y: Math.min(p.y, d0.start.y), w: Math.max(1, Math.abs(p.x - d0.start.x)), h: Math.max(1, Math.abs(p.y - d0.start.y)) };
          return i;
        }),
      }), false);
    } else if (d0.mode === "move") {
      const dx = p.x - d0.start.x, dy = p.y - d0.start.y;
      commit((d) => {
        const it = d0.orig;
        if (isPointItem(it) && frame > 0 && d0.origPos) {
          const frames = d.frames.map((f, k) => (k === frame ? { ...f, pos: { ...f.pos, [it.id]: { x: d0.origPos!.x + dx, y: d0.origPos!.y + dy } } } : f));
          return { ...d, frames };
        }
        return { ...d, items: d.items.map((i) => (i.id === it.id ? translate(it, dx, dy) : i)) };
      }, false);
    } else if (d0.mode === "handle") {
      commit((d) => ({
        ...d,
        items: d.items.map((i) => {
          if (i.id !== d0.id) return i;
          if ((i.type === "arrow" || i.type === "dim") && (d0.handle === "from" || d0.handle === "to")) return { ...i, [d0.handle]: p };
          if (i.type === "arrow" && d0.handle === "ctrl") return { ...i, ctrl: p };
          if (i.type === "zone" && d0.handle === "size") return { ...i, w: Math.max(10, p.x - i.x), h: Math.max(10, p.y - i.y) };
          return i;
        }),
      }), false);
    }
  };
  const onUp = () => {
    const d0 = drag.current;
    drag.current = null;
    if (d0?.mode === "draw") {
      // Un simple clic crée un élément de taille par défaut.
      commit((d) => ({
        ...d,
        items: d.items.map((i) => {
          if (i.id !== d0.id) return i;
          if ((i.type === "arrow" || i.type === "dim") && Math.hypot(i.to.x - i.from.x, i.to.y - i.from.y) < 15) return { ...i, to: { x: i.from.x + 120, y: i.from.y } };
          if (i.type === "zone" && (i.w < 15 || i.h < 15)) return { ...i, w: 160, h: 110 };
          return i;
        }),
      }), false);
    }
  };

  const patchSel = (patch: Record<string, unknown>) => sel && commit((d) => ({ ...d, items: d.items.map((i) => (i.id === sel ? ({ ...i, ...patch } as Item) : i)) }));

  // Étapes d'animation
  const addFrame = () => { commit((d) => ({ ...d, frames: [...d.frames, { id: newId(), pos: {} }] })); setFrame(doc.frames.length); };
  const removeFrame = () => {
    if (frame === 0) return;
    commit((d) => ({ ...d, frames: d.frames.filter((_, k) => k !== frame) }));
    setFrame((f) => Math.max(0, f - 1));
  };

  const setPitch = (kind: PitchKind, style: PitchStyle) => commit((d) => ({ ...d, pitch: { ...d.pitch, kind, style } }));

  const exportImage = (type: "png" | "jpeg" | "svg") =>
    start(async () => {
      const svg = diagramSvg(doc, frame);
      const name = `${slug(title)}${doc.frames.length > 1 ? `-etape-${frame + 1}` : ""}`;
      if (type === "svg") return downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
      // 300 DPI pour une largeur imprimée d'environ 17 cm.
      const scale = Math.max(2, Math.round((2000 / w) * 10) / 10);
      const blob = await svgToBlob(svg, w, h, { scale, type: type === "png" ? "image/png" : "image/jpeg", quality: 0.92 });
      downloadBlob(blob, `${name}.${type === "png" ? "png" : "jpg"}`);
    });
  const exportJson = () => downloadBlob(new Blob([JSON.stringify({ title, ...doc }, null, 1)], { type: "application/json" }), `${slug(title)}.schema.json`);
  const importJson = async (f: File) => {
    setMsg(null);
    if (f.size > 400_000) return setMsg({ tone: "err", text: "Fichier trop volumineux (400 Ko maximum)." });
    try {
      const raw = JSON.parse(await f.text());
      const d = parseDiagram({ v: raw.v, pitch: raw.pitch, items: raw.items, frames: raw.frames });
      if (!d) return setMsg({ tone: "err", text: "Ce fichier n'est pas un schéma valide de la plateforme." });
      commit(() => d);
      if (typeof raw.title === "string" && raw.title.trim().length >= 2) setTitle(raw.title.slice(0, 120));
      setFrame(0);
      setSel(null);
      setMsg({ tone: "ok", text: "Schéma importé : pense à l'enregistrer." });
    } catch {
      setMsg({ tone: "err", text: "Lecture du fichier impossible (JSON attendu)." });
    }
  };

  const save = (mode: SaveMode) =>
    start(async () => {
      if (!onSave) return;
      setMsg(null);
      const r = await onSave(title, doc, mode);
      if (r.ok) { setDirty(false); setMsg({ tone: "ok", text: mode === "copy" ? "Copie enregistrée pour cette séance." : "Schéma enregistré." }); }
      else setMsg({ tone: "err", text: r.error ?? "Enregistrement refusé." });
    });

  const shownFrame = play ? play.frame : frame;
  const shownT = play ? play.t : 0;
  const pitch = useMemo(() => pitchShapes(doc.pitch), [doc.pitch]);
  const items = sortedItems(doc);

  return (
    <div className="flex flex-col gap-3">
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Titre du schéma" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="h-9 max-w-xs" />
          <Select aria-label="Type de terrain" className="h-9 w-auto" value={doc.pitch.kind} onChange={(e) => setPitch(e.target.value as PitchKind, doc.pitch.style)}>
            {Object.entries(PITCH_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select aria-label="Aspect du terrain" className="h-9 w-auto" value={doc.pitch.style} onChange={(e) => setPitch(doc.pitch.kind, e.target.value as PitchStyle)}>
            <option value="stripes">Pelouse rayée</option>
            <option value="grass">Pelouse unie</option>
            <option value="plain">Fond blanc (impression)</option>
          </Select>
          <span className="flex-1" />
          <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={!hist.past} aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)"><Undo2 /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={redo} disabled={!hist.future} aria-label="Rétablir (Ctrl+Y)" title="Rétablir (Ctrl+Y)"><Redo2 /></Button>
        </div>
      ) : null}

      {!readOnly ? <Toolbox tool={tool} setTool={(t) => { setTool(t); if (t.t !== "select") setSel(null); }} /> : null}
      <div className={cn("grid gap-3", !readOnly && "xl:grid-cols-[1fr_230px]")}>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="overflow-hidden rounded-lg border bg-[#2f7d2b] shadow-inner">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${w} ${h}`}
              className={cn("block h-auto w-full touch-none select-none", !readOnly && tool.t !== "select" && "cursor-crosshair")}
              role="img"
              aria-label={`Schéma tactique : ${title}`}
              onPointerDown={onBoardDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <Shapes shapes={pitch} />
              {items.map((it) => (
                <g key={it.id} onPointerDown={(e) => onItemDown(e, it)} className={cn(!readOnly && tool.t === "select" && "cursor-move")}>
                  <Shapes shapes={itemShapes(doc, it, shownFrame, shownT)} />
                  <HitArea item={it} doc={doc} frame={shownFrame} />
                </g>
              ))}
              {!readOnly && selected && !play ? <Handles item={selected} doc={doc} frame={frame} onHandleDown={onHandleDown} /> : null}
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Étapes</span>
            {doc.frames.map((f, k) => (
              <button key={f.id} type="button" onClick={() => { setPlay(null); setFrame(k); }}
                className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", k === shownFrame ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
                {k + 1}
              </button>
            ))}
            {!readOnly && doc.frames.length < 20 ? <Button type="button" size="sm" variant="outline" onClick={addFrame}><Plus />Étape</Button> : null}
            {!readOnly && frame > 0 ? <Button type="button" size="sm" variant="ghost" onClick={removeFrame} aria-label="Supprimer l'étape"><X /></Button> : null}
            {doc.frames.length > 1 ? (
              play ? <Button type="button" size="sm" variant="secondary" onClick={() => setPlay(null)}><Pause />Pause</Button>
                : <Button type="button" size="sm" variant="secondary" onClick={() => { setSel(null); setPlay({ frame: 0, t: 0 }); }}><Play />Animer</Button>
            ) : null}
            {!readOnly && frame > 0 ? <span className="text-xs text-muted-foreground">Déplace les joueuses et le ballon : seules les nouvelles positions sont enregistrées pour cette étape.</span> : null}
          </div>
        </div>

        {!readOnly ? (
          <div className="flex flex-col gap-3 text-sm">
            <Properties item={selected} onPatch={patchSel} onDelete={removeSel} onDuplicate={duplicateSel} roster={roster} />
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Exporter / importer</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => exportImage("png")}><ImageIcon />PNG HD</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => exportImage("jpeg")}><Download />JPEG</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => exportImage("svg")}><Download />SVG</Button>
                <Button type="button" size="sm" variant="outline" onClick={exportJson}><FileJson />Données</Button>
              </div>
              {printHref ? (
                <a href={printHref} target="_blank" rel="noopener" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted">
                  <Printer className="size-4" />PDF · toutes les étapes
                </a>
              ) : null}
              {printHref && dirty ? <p className="text-[11px] text-warning">Enregistre d&apos;abord pour imprimer la dernière version.</p> : null}
              <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload />Importer un schéma (.json)</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
            </div>
          </div>
        ) : null}
      </div>

      {msg ? <p role="status" className={cn("text-sm font-medium", msg.tone === "ok" ? "text-success" : "text-danger")}>{msg.text}</p> : null}

      {!readOnly && onSave ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" disabled={pending || title.trim().length < 2} onClick={() => save("update")}><Save />Enregistrer le schéma</Button>
          {canCopy ? <Button type="button" variant="outline" disabled={pending || title.trim().length < 2} onClick={() => save("copy")}><Copy />Enregistrer une version pour cette séance</Button> : null}
          {onClose ? <Button type="button" variant="ghost" onClick={onClose}>Fermer</Button> : null}
          {dirty ? <span className="text-xs font-medium text-warning">Modifications non enregistrées</span> : null}
          {saveHint ? <span className="w-full text-xs text-muted-foreground">{saveHint}</span> : null}
        </div>
      ) : null}
      {!readOnly ? <p className="text-[11px] text-muted-foreground">Raccourcis : Suppr pour effacer, Ctrl+Z / Ctrl+Y, Ctrl+D pour dupliquer, flèches pour déplacer, Échap pour revenir à la sélection.</p> : null}
    </div>
  );
}

function translate(it: Item, dx: number, dy: number): Item {
  const m = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  if (it.type === "arrow") return { ...it, from: m(it.from), to: m(it.to), ctrl: it.ctrl ? m(it.ctrl) : it.ctrl };
  if (it.type === "dim") return { ...it, from: m(it.from), to: m(it.to) };
  return { ...it, x: it.x + dx, y: it.y + dy } as Item;
}

function moveItem(d: Diagram, id: string, dx: number, dy: number, frame: number): Diagram {
  const it = d.items.find((i) => i.id === id);
  if (!it) return d;
  if (isPointItem(it) && frame > 0) {
    const p = posAt(d, it, frame);
    return { ...d, frames: d.frames.map((f, k) => (k === frame ? { ...f, pos: { ...f.pos, [id]: { x: p.x + dx, y: p.y + dy } } } : f)) };
  }
  return { ...d, items: d.items.map((i) => (i.id === id ? translate(i, dx, dy) : i)) };
}

function HitArea({ item, doc, frame }: { item: Item; doc: Diagram; frame: number }) {
  if (item.type === "arrow" || item.type === "dim") {
    const d = item.type === "arrow" && item.ctrl ? `M ${item.from.x} ${item.from.y} Q ${item.ctrl.x} ${item.ctrl.y} ${item.to.x} ${item.to.y}` : `M ${item.from.x} ${item.from.y} L ${item.to.x} ${item.to.y}`;
    return <path d={d} stroke="transparent" strokeWidth={22} fill="none" />;
  }
  if (item.type === "zone") return <rect x={item.x} y={item.y} width={item.w} height={item.h} fill="transparent" />;
  const p = posAt(doc, item, frame);
  if (item.type === "text") return <rect x={p.x - 4} y={p.y - item.size} width={Math.max(30, item.text.length * item.size * 0.6)} height={item.size + 8} fill="transparent" />;
  return <circle cx={p.x} cy={p.y} r={item.type === "ladder" ? 40 : item.type === "goal" ? 38 : 22} fill="transparent" />;
}

type HandleKind = "from" | "to" | "ctrl" | "size";
function HandleDot({ p, h, id, square, onHandleDown }: { p: Pt; h: HandleKind; id: string; square?: boolean; onHandleDown: (e: React.PointerEvent, id: string, h: HandleKind) => void }) {
  return square
    ? <rect x={p.x - 9} y={p.y - 9} width={18} height={18} fill="#ffffff" stroke="#E6007E" strokeWidth={3} className="cursor-nwse-resize" onPointerDown={(e) => onHandleDown(e, id, h)} />
    : <circle cx={p.x} cy={p.y} r={10} fill={h === "ctrl" ? "#E6007E" : "#ffffff"} stroke="#E6007E" strokeWidth={3} className="cursor-pointer" onPointerDown={(e) => onHandleDown(e, id, h)} />;
}

function Handles({ item, doc, frame, onHandleDown }: { item: Item; doc: Diagram; frame: number; onHandleDown: (e: React.PointerEvent, id: string, h: HandleKind) => void }) {
  const k = { id: item.id, onHandleDown };
  if (item.type === "arrow") {
    const ctrl = item.ctrl ?? { x: (item.from.x + item.to.x) / 2, y: (item.from.y + item.to.y) / 2 };
    return <g><HandleDot p={item.from} h="from" {...k} /><HandleDot p={item.to} h="to" {...k} /><HandleDot p={ctrl} h="ctrl" {...k} /></g>;
  }
  if (item.type === "dim") return <g><HandleDot p={item.from} h="from" {...k} /><HandleDot p={item.to} h="to" {...k} /></g>;
  if (item.type === "zone") return <g><rect x={item.x} y={item.y} width={item.w} height={item.h} fill="none" stroke="#E6007E" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" /><HandleDot p={{ x: item.x + item.w, y: item.y + item.h }} h="size" square {...k} /></g>;
  const p = posAt(doc, item, frame);
  return <circle cx={p.x} cy={p.y} r={26} fill="none" stroke="#E6007E" strokeWidth={3} strokeDasharray="6 4" pointerEvents="none" />;
}

function ToolBtn({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors", active ? "border-primary bg-primary/10 text-primary-text" : "hover:bg-accent")}>
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-full text-[10px] font-semibold uppercase text-muted-foreground sm:w-16 sm:pr-1">{label}</span>
      {children}
    </div>
  );
}

function Toolbox({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const is = (t: Tool) => JSON.stringify(t) === JSON.stringify(tool);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-2" role="toolbar" aria-label="Outils du tableau tactique">
      <Group label="Outils">
        <ToolBtn active={is({ t: "select" })} onClick={() => setTool({ t: "select" })} label="Sélectionner et déplacer"><MousePointer2 className="size-4" />Sélection</ToolBtn>
        {(Object.keys(TEAM_COLORS) as Team[]).map((t) => (
          <ToolBtn key={t} active={is({ t: "player", team: t })} onClick={() => setTool({ t: "player", team: t })} label={TEAM_COLORS[t].label}>
            <span className="size-3.5 rounded-full border border-white shadow" style={{ background: TEAM_COLORS[t].fill }} />{TEAM_COLORS[t].label}
          </ToolBtn>
        ))}
      </Group>
      <Group label="Matériel">
        {(Object.keys(EQUIP_LABELS) as EquipKind[]).map((k) => (
          <ToolBtn key={k} active={is({ t: "equip", kind: k })} onClick={() => setTool({ t: "equip", kind: k })} label={EQUIP_LABELS[k]}><Hand className="size-3.5" />{EQUIP_LABELS[k]}</ToolBtn>
        ))}
      </Group>
      <Group label="Tracés">
        {(Object.keys(ARROW_LABELS) as ArrowKind[]).map((k) => (
          <ToolBtn key={k} active={is({ t: "arrow", kind: k })} onClick={() => setTool({ t: "arrow", kind: k })} label={`Flèche : ${ARROW_LABELS[k]}`}>
            <ArrowGlyph kind={k} />{ARROW_LABELS[k]}
          </ToolBtn>
        ))}
        <ToolBtn active={is({ t: "zone", shape: "rect" })} onClick={() => setTool({ t: "zone", shape: "rect" })} label="Zone rectangulaire"><Square className="size-3.5" />Zone</ToolBtn>
        <ToolBtn active={is({ t: "zone", shape: "ellipse" })} onClick={() => setTool({ t: "zone", shape: "ellipse" })} label="Zone ovale"><CircleIcon className="size-3.5" />Zone ovale</ToolBtn>
        <ToolBtn active={is({ t: "dim" })} onClick={() => setTool({ t: "dim" })} label="Cote (dimension)"><Ruler className="size-3.5" />Dimension</ToolBtn>
        <ToolBtn active={is({ t: "text" })} onClick={() => setTool({ t: "text" })} label="Annotation"><Type className="size-3.5" />Texte</ToolBtn>
      </Group>
    </div>
  );
}

function ArrowGlyph({ kind }: { kind: ArrowKind }) {
  return (
    <svg viewBox="0 0 24 12" className="h-3 w-6" aria-hidden>
      {kind === "dribble" ? <path d="M1 6 q2 -4 4 0 t4 0 t4 0 t4 0" stroke="currentColor" fill="none" strokeWidth={1.6} /> : <line x1={1} y1={6} x2={18} y2={6} stroke="currentColor" strokeWidth={kind === "shot" ? 3 : 1.8} strokeDasharray={kind === "pass" ? "3 2" : undefined} />}
      <polygon points="23,6 17,2 17,10" fill="currentColor" />
    </svg>
  );
}

function Properties({ item, onPatch, onDelete, onDuplicate, roster }: { item: Item | null; onPatch: (p: Record<string, unknown>) => void; onDelete: () => void; onDuplicate: () => void; roster?: RosterEntry[] }) {
  if (!item) return <p className="rounded-lg border p-3 text-xs text-muted-foreground">Choisis un outil puis touche le terrain. Pour les flèches, zones et cotes, fais glisser. Sélectionne un élément pour le modifier.</p>;
  const colors = (k: string, value?: string) => (
    <div className="flex flex-wrap gap-1">
      {PALETTE.map((c) => (
        <button key={c} type="button" aria-label={`Couleur ${c}`} aria-pressed={value === c} onClick={() => onPatch({ [k]: c })}
          className={cn("size-6 rounded-full border-2", value === c ? "border-primary" : "border-border")} style={{ background: c }} />
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {item.type === "player" ? "Joueuse" : item.type === "arrow" ? `Flèche · ${ARROW_LABELS[item.kind]}` : item.type === "zone" ? "Zone" : item.type === "text" ? "Annotation" : item.type === "dim" ? "Dimension" : EQUIP_LABELS[item.type]}
      </p>
      {item.type === "player" ? (
        <>
          {roster?.length ? (
            <label className="text-xs">Joueuse de l&apos;effectif
              <Select className="mt-1 h-8" value={item.pid ?? ""} onChange={(e) => {
                const r = roster.find((x) => x.id === e.target.value);
                onPatch(r ? { pid: r.id, name: r.name, ...(r.number ? { label: String(r.number) } : {}) } : { pid: undefined, name: undefined });
              }}>
                <option value="">— Aucune (pion anonyme) —</option>
                {roster.map((r) => <option key={r.id} value={r.id}>{r.number ? `${r.number} · ` : ""}{r.name}</option>)}
              </Select>
            </label>
          ) : null}
          <label className="text-xs">Nom affiché<Input className="mt-1 h-8" value={item.name ?? ""} maxLength={24} placeholder="Ex. A. KONÉ" onChange={(e) => onPatch({ name: e.target.value || undefined, pid: undefined })} /></label>
          <label className="text-xs">Numéro / initiales<Input className="mt-1 h-8" value={item.label} maxLength={3} onChange={(e) => onPatch({ label: e.target.value.toUpperCase() })} /></label>
          <label className="text-xs">Équipe
            <Select className="mt-1 h-8" value={item.team} onChange={(e) => onPatch({ team: e.target.value })}>
              {(Object.keys(TEAM_COLORS) as Team[]).map((t) => <option key={t} value={t}>{TEAM_COLORS[t].label}</option>)}
            </Select>
          </label>
        </>
      ) : null}
      {item.type === "arrow" ? (
        <>
          <label className="text-xs">Type
            <Select className="mt-1 h-8" value={item.kind} onChange={(e) => onPatch({ kind: e.target.value })}>
              {(Object.keys(ARROW_LABELS) as ArrowKind[]).map((k) => <option key={k} value={k}>{ARROW_LABELS[k]}</option>)}
            </Select>
          </label>
          {colors("color", item.color)}
          {item.ctrl ? <Button type="button" size="sm" variant="ghost" onClick={() => onPatch({ ctrl: null })}>Redresser la flèche</Button> : <p className="text-[11px] text-muted-foreground">Fais glisser le point rose pour courber la flèche.</p>}
        </>
      ) : null}
      {item.type === "zone" ? (
        <>
          <label className="text-xs">Libellé<Input className="mt-1 h-8" value={item.label ?? ""} maxLength={40} onChange={(e) => onPatch({ label: e.target.value })} /></label>
          {colors("color", item.color)}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.hatch} disabled={item.shape !== "rect"} onChange={(e) => onPatch({ hatch: e.target.checked })} />Hachures</label>
        </>
      ) : null}
      {item.type === "text" ? (
        <>
          <label className="text-xs">Texte<Input className="mt-1 h-8" value={item.text} maxLength={80} onChange={(e) => onPatch({ text: e.target.value })} /></label>
          <label className="text-xs">Taille<Input className="mt-1 h-8" type="number" min={8} max={60} value={item.size} onChange={(e) => onPatch({ size: Math.max(8, Math.min(60, Number(e.target.value) || 22)) })} /></label>
          {colors("color", item.color)}
        </>
      ) : null}
      {item.type === "dim" ? <label className="text-xs">Mesure<Input className="mt-1 h-8" value={item.label} maxLength={20} placeholder="Ex. 30 m" onChange={(e) => onPatch({ label: e.target.value })} /></label> : null}
      {["cone", "disc", "mannequin", "pole", "ladder", "hurdle"].includes(item.type) ? colors("color", (item as { color?: string }).color) : null}
      <div className="flex gap-1.5 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onDuplicate}><Copy />Dupliquer</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDelete}><Trash2 />Supprimer</Button>
      </div>
    </div>
  );
}
