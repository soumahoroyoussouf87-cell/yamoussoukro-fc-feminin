"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Save } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { FORMATIONS, SYSTEMS, slotsFor } from "@/lib/domain/formations";
import { LINEUP_STATUS_LABELS } from "@/lib/phase2/labels";
import { PitchMarkings } from "./pitch";
import { cn } from "@/lib/utils";
import type { LineupPayload } from "@/app/(app)/competition/actions";

export type EditorPlayer = { id: string; name: string; short: string; shirt: number | null; position: string | null; availability: string | null };
type Starter = { player_id: string | null; label: string; x: number; y: number };
type Extra = { is_captain: boolean; takes_penalties: boolean; takes_free_kicks: boolean; takes_corners: boolean; responsibilities: string };
export type LineupInitial = {
  id: string | null; label: string; system: string; status: string; instructions: string | null;
  players: { player_id: string; slot: string; position_label: string | null; x: number | null; y: number | null; is_captain: boolean; takes_penalties: boolean; takes_free_kicks: boolean; takes_corners: boolean; responsibilities: string | null }[];
};

const noExtra = (): Extra => ({ is_captain: false, takes_penalties: false, takes_free_kicks: false, takes_corners: false, responsibilities: "" });

export function LineupEditor({
  matchId, title, players, initial, canWrite, canValidate, onSave, onStatus,
}: {
  matchId: string;
  title: string;
  players: EditorPlayer[];
  initial: LineupInitial;
  canWrite: boolean;
  canValidate: boolean;
  onSave: (matchId: string, payload: LineupPayload) => Promise<{ error?: string; id?: string }>;
  onStatus?: (to: string) => Promise<{ error?: string } | void>;
}) {
  const router = useRouter();
  const editable = canWrite && (initial.status === "provisoire" || canValidate);
  const [label, setLabel] = useState(initial.label);
  const [system, setSystem] = useState(initial.system in FORMATIONS || initial.system === "Personnalisé" ? initial.system : "4-3-3");
  const [instructions, setInstructions] = useState(initial.instructions ?? "");
  const [starters, setStarters] = useState<Starter[]>(() => {
    const base = slotsFor(initial.system).map((s) => ({ player_id: null as string | null, ...s }));
    const st = initial.players.filter((p) => p.slot === "titulaire");
    st.forEach((p, i) => {
      if (i < 11) base[i] = { player_id: p.player_id, label: p.position_label ?? base[i].label, x: p.x ?? base[i].x, y: p.y ?? base[i].y };
    });
    return base;
  });
  const [bench, setBench] = useState<string[]>(() => initial.players.filter((p) => p.slot === "remplacante").map((p) => p.player_id));
  const [extras, setExtras] = useState<Record<string, Extra>>(() =>
    Object.fromEntries(initial.players.map((p) => [p.player_id, { is_captain: p.is_captain, takes_penalties: p.takes_penalties, takes_free_kicks: p.takes_free_kicks, takes_corners: p.takes_corners, responsibilities: p.responsibilities ?? "" }])),
  );
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pitchRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; moved: boolean } | null>(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const used = new Set([...starters.map((s) => s.player_id).filter(Boolean), ...bench] as string[]);
  const available = players.filter((p) => !used.has(p.id));
  const ex = (id: string) => extras[id] ?? noExtra();

  function changeSystem(s: string) {
    setSystem(s);
    if (s === "Personnalisé") return;
    const slots = slotsFor(s);
    setStarters((cur) => slots.map((slot, i) => ({ ...slot, player_id: cur[i]?.player_id ?? null })));
  }
  function assign(index: number, playerId: string) {
    setBench((b) => b.filter((x) => x !== playerId));
    setStarters((cur) => cur.map((s, i) => (i === index ? { ...s, player_id: playerId } : s.player_id === playerId ? { ...s, player_id: null } : s)));
    setSelectedSlot(null);
    setFocus(playerId);
  }
  function pickPlayer(playerId: string) {
    if (!editable) return;
    if (selectedSlot != null) assign(selectedSlot, playerId);
    else {
      const free = starters.findIndex((s) => !s.player_id);
      if (free >= 0) assign(free, playerId);
      else setBench((b) => [...b, playerId]);
    }
  }
  function removeFromPitch(index: number) {
    setStarters((cur) => cur.map((s, i) => (i === index ? { ...s, player_id: null } : s)));
  }
  function toggle(id: string, key: keyof Omit<Extra, "responsibilities">) {
    setExtras((cur) => {
      const next = { ...cur };
      if (key === "is_captain") for (const k of Object.keys(next)) next[k] = { ...next[k], is_captain: false };
      next[id] = { ...(next[id] ?? noExtra()), [key]: !(cur[id] ?? noExtra())[key] };
      return next;
    });
  }
  function pointerDown(e: React.PointerEvent, index: number) {
    if (!editable) return;
    drag.current = { index, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drag.current || !pitchRef.current) return;
    const r = pitchRef.current.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(97, Math.max(3, ((e.clientY - r.top) / r.height) * 100));
    drag.current.moved = true;
    const i = drag.current.index;
    setStarters((cur) => cur.map((s, k) => (k === i ? { ...s, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : s)));
  }
  function pointerUp(index: number) {
    const d = drag.current;
    drag.current = null;
    if (d && d.moved) return;
    setSelectedSlot((cur) => (cur === index ? null : index));
    const pid = starters[index]?.player_id;
    if (pid) setFocus(pid);
  }

  function save() {
    const payload: LineupPayload = {
      id: initial.id,
      label: label.trim() || "Composition principale",
      system,
      instructions: instructions.trim() || null,
      players: [
        ...starters.filter((s) => s.player_id).map((s) => ({ player_id: s.player_id!, slot: "titulaire" as const, position_label: s.label, x: s.x, y: s.y, ...ex(s.player_id!), responsibilities: ex(s.player_id!).responsibilities.trim() || null })),
        ...bench.map((id) => ({ player_id: id, slot: "remplacante" as const, position_label: null, x: null, y: null, ...ex(id), responsibilities: ex(id).responsibilities.trim() || null })),
      ],
    };
    start(async () => {
      setMsg(null);
      const r = await onSave(matchId, payload);
      if (r.error) setMsg({ tone: "err", text: r.error });
      else {
        setMsg({ tone: "ok", text: "Composition enregistrée (nouvelle version dans l'historique)." });
        if (!initial.id && r.id) router.replace(`/competition/rencontres/${matchId}/onze?compo=${r.id}`);
        else router.refresh();
      }
    });
  }
  function status(to: string) {
    start(async () => {
      setMsg(null);
      if (!onStatus) return;
      const r = await onStatus(to);
      if (r && r.error) setMsg({ tone: "err", text: r.error });
      else router.refresh();
    });
  }
  async function exportPng() {
    if (!exportRef.current) return;
    try {
      const url = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: "#0b1020" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `onze-${label.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
      a.click();
    } catch {
      setMsg({ tone: "err", text: "Export PNG impossible dans ce navigateur." });
    }
  }

  const captain = Object.entries(extras).find(([id, e]) => e.is_captain && used.has(id))?.[0];
  const takers = (k: keyof Omit<Extra, "responsibilities" | "is_captain">) => [...used].filter((id) => ex(id)[k]).map((id) => byId.get(id)?.short).filter(Boolean).join(", ");
  const focusPlayer = focus && used.has(focus) ? byId.get(focus) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm"><span className="text-xs font-medium">Nom de la composition</span><Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!editable} maxLength={60} className="h-9 w-56" /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="text-xs font-medium">Système</span>
            <Select value={system} onChange={(e) => changeSystem(e.target.value)} disabled={!editable} className="h-9 w-52">
              {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          <Badge variant={initial.status === "provisoire" ? "warning" : "success"} className="mb-2">{LINEUP_STATUS_LABELS[initial.status]}</Badge>
          <span className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={exportPng}><Download />PNG</Button>
          {editable ? <Button type="button" size="sm" onClick={save} disabled={pending}><Save />{pending ? "…" : "Enregistrer"}</Button> : null}
        </div>
        {msg ? <p role={msg.tone === "err" ? "alert" : "status"} className={cn("rounded-md px-3 py-2 text-sm font-medium", msg.tone === "err" ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>{msg.text}</p> : null}

        <div ref={exportRef} className="rounded-xl bg-[#0b1020] p-3 text-white">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#ff0068]">Yamoussoukro FC Féminin</p><p className="font-display text-lg font-bold uppercase">{title}</p></div>
            <p className="font-display text-xl font-bold">{system}</p>
          </div>
          <div
            ref={pitchRef}
            className="relative mx-auto w-full max-w-[520px] touch-none select-none overflow-hidden rounded-lg"
            style={{ aspectRatio: "68 / 105" }}
            onPointerMove={pointerMove}
            onDragOver={(e) => editable && e.preventDefault()}
          >
            <PitchMarkings />
            {starters.map((s, i) => {
              const p = s.player_id ? byId.get(s.player_id) : null;
              return (
                <button
                  key={i}
                  type="button"
                  className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5", editable && "cursor-grab")}
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  onPointerDown={(e) => pointerDown(e, i)}
                  onPointerUp={() => pointerUp(i)}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id && editable) assign(i, id); }}
                  onDragOver={(e) => editable && e.preventDefault()}
                  aria-label={p ? `${s.label} : ${p.name}` : `Poste ${s.label} libre`}
                >
                  <span className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2 font-display text-sm font-bold shadow-lg sm:size-11",
                    p ? (s.label === "GB" ? "border-white bg-[#f5b700] text-black" : "border-white bg-[#ff0068] text-white") : "border-dashed border-white/80 bg-black/30 text-white/90",
                    selectedSlot === i && "ring-4 ring-yellow-300",
                  )}>
                    {p ? (p.shirt ?? s.label) : s.label}
                  </span>
                  {p ? (
                    <span className="max-w-24 truncate rounded bg-black/60 px-1 text-[10px] font-semibold leading-tight sm:text-[11px]">
                      {p.short}{extras[p.id]?.is_captain ? " (C)" : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 px-1 text-xs sm:grid-cols-2">
            <div><p className="font-semibold uppercase tracking-wide text-white/60">Remplaçantes</p><p>{bench.map((id) => { const p = byId.get(id); return p ? `${p.shirt ?? ""} ${p.short}`.trim() : ""; }).join(" · ") || "—"}</p></div>
            <div className="flex flex-col gap-0.5">
              <p><span className="text-white/60">Capitaine :</span> {captain ? byId.get(captain)?.short : "—"}</p>
              <p><span className="text-white/60">Penalties :</span> {takers("takes_penalties") || "—"}</p>
              <p><span className="text-white/60">Coups francs :</span> {takers("takes_free_kicks") || "—"}</p>
              <p><span className="text-white/60">Corners :</span> {takers("takes_corners") || "—"}</p>
            </div>
          </div>
        </div>
        {editable ? <p className="text-xs text-muted-foreground">Touchez un poste puis une joueuse pour l&apos;y placer (ou glissez une joueuse sur un poste). Glissez un rond pour ajuster sa position sur le terrain.</p> : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Consignes</span>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={!editable} maxLength={3000} rows={3} />
        </label>

        {canValidate && initial.id ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
            <span className="flex-1 text-muted-foreground">Une composition provisoire reste confidentielle. Une seule composition peut être officielle par match.</span>
            {initial.status === "provisoire" ? <Button size="sm" onClick={() => status("validee")} disabled={pending}>Valider (officielle)</Button> : null}
            {initial.status !== "communiquee" ? <Button size="sm" variant="secondary" onClick={() => status("communiquee")} disabled={pending}>Autoriser la communication</Button> : null}
            {initial.status !== "provisoire" ? <Button size="sm" variant="outline" onClick={() => status("provisoire")} disabled={pending}>Repasser en provisoire</Button> : null}
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col gap-3">
        {focusPlayer && editable ? (
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p className="font-semibold">{focusPlayer.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {([["is_captain", "Capitaine"], ["takes_penalties", "Penalties"], ["takes_free_kicks", "Coups francs"], ["takes_corners", "Corners"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={ex(focusPlayer.id)[k]} onChange={() => toggle(focusPlayer.id, k)} className="size-4 accent-[#ff0068]" />{l}</label>
              ))}
            </div>
            <label className="mt-2 flex flex-col gap-1"><span className="text-xs">Responsabilités</span>
              <Input value={ex(focusPlayer.id).responsibilities} maxLength={500} className="h-9"
                onChange={(e) => setExtras((c) => ({ ...c, [focusPlayer.id]: { ...(c[focusPlayer.id] ?? noExtra()), responsibilities: e.target.value } }))} />
            </label>
            <div className="mt-2 flex gap-2">
              {starters.some((s) => s.player_id === focusPlayer.id) ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => { const i = starters.findIndex((s) => s.player_id === focusPlayer.id); removeFromPitch(i); setBench((b) => [...b, focusPlayer.id]); }}>Mettre sur le banc</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeFromPitch(starters.findIndex((s) => s.player_id === focusPlayer.id))}>Retirer</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setBench((b) => b.filter((x) => x !== focusPlayer.id))}>Retirer du banc</Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">Banc ({bench.length})</p>
          {bench.length === 0 ? <p className="text-xs text-muted-foreground">Aucune remplaçante.</p> : (
            <ul className="flex flex-col gap-1">
              {bench.map((id) => { const p = byId.get(id); return p ? (
                <li key={id}><button type="button" onClick={() => setFocus(id)} className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"><span className="font-display font-bold">{p.shirt ?? ""}</span> {p.name} <span className="text-xs text-muted-foreground">{p.position ?? ""}</span></button></li>
              ) : null; })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 text-sm font-semibold">Joueuses disponibles ({available.length})</p>
          {selectedSlot != null && editable ? <p className="mb-2 rounded bg-yellow-300/20 px-2 py-1 text-xs">Choisissez la joueuse pour le poste {starters[selectedSlot].label}.</p> : null}
          <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
            {available.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button type="button" draggable={editable} onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)} onClick={() => pickPlayer(p.id)} disabled={!editable}
                  className="flex-1 rounded px-2 py-1 text-left text-sm hover:bg-accent disabled:cursor-default">
                  <span className="font-display font-bold">{p.shirt ?? ""}</span> {p.name} <span className="text-xs text-muted-foreground">{p.position ?? ""}</span>
                  {p.availability && p.availability !== "disponible" ? <span className="ml-1 text-[11px] text-warning">({p.availability})</span> : null}
                </button>
                {editable ? <button type="button" onClick={() => setBench((b) => [...b, p.id])} className="rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-accent" title="Ajouter au banc">Banc</button> : null}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
