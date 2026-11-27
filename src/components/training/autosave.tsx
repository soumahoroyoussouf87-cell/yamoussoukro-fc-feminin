"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, Loader2 } from "lucide-react";

export type SaveState = { status: "idle" | "pending" | "saving" | "saved" | "error"; error?: string; fields?: Record<string, string>; at?: Date };
type SaveFn<P> = (patch: P) => Promise<{ ok: true } | { ok: false; error: string; fields?: Record<string, string> }>;

/**
 * Sauvegarde automatique : regroupe les modifications et les envoie après un court délai.
 * Les modifications en attente sont envoyées avant de quitter la page.
 */
export function useAutosave<P extends Record<string, unknown>>(save: SaveFn<P>, opts: { delay?: number; onSaved?: (patch: Partial<P>) => void } = {}) {
  const delay = opts.delay ?? 900;
  const onSavedRef = useRef(opts.onSaved);
  useEffect(() => { onSavedRef.current = opts.onSaved; });
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const pending = useRef<Partial<P>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const inflight = useRef<Promise<void> | null>(null);
  useEffect(() => { saveRef.current = save; }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setState({ status: "saving" });
    const run = (async () => {
      try {
        const r = await saveRef.current(patch as P);
        if (r.ok) { setState({ status: "saved", at: new Date() }); onSavedRef.current?.(patch); }
        else {
          // Les champs refusés restent à renvoyer après correction.
          pending.current = { ...patch, ...pending.current };
          setState({ status: "error", error: r.error, fields: r.fields });
        }
      } catch {
        pending.current = { ...patch, ...pending.current };
        setState({ status: "error", error: "Connexion perdue : les modifications seront renvoyées." });
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
  }, []);

  const queue = useCallback((patch: Partial<P>, now = false) => {
    pending.current = { ...pending.current, ...patch };
    setState((s) => (s.status === "error" ? { ...s, status: "pending" } : { status: "pending" }));
    if (timer.current) clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = setTimeout(() => void flush(), delay);
  }, [delay, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) { void flush(); e.preventDefault(); }
    };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); void flush(); };
  }, [flush]);

  return { state, queue, flush };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state.status === "idle") return null;
  if (state.status === "error")
    return <span role="alert" className="inline-flex items-center gap-1 text-xs font-medium text-danger"><CloudOff className="size-3.5" aria-hidden />{state.error}</span>;
  if (state.status === "saved")
    return <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="size-3.5" aria-hidden />Enregistré {state.at ? `à ${state.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden />Enregistrement…</span>;
}
