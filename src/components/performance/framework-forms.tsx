"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { createDraftVersion, setMinObservations } from "@/lib/performance/actions";

export function NewVersionForm({ fromId }: { fromId: string }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createDraftVersion(fromId, label);
        if (r?.error) setErr(r.error);
      });
    }}>
      <label className="flex-1 text-sm font-medium">Nouvelle version (copie de la version publiée)
        <Input value={label} maxLength={120} placeholder="Ex. Version 2 — ajustements N°8" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "…" : "Créer le brouillon"}</Button>
      {err ? <p role="alert" className="w-full text-sm text-danger">{err}</p> : null}
    </form>
  );
}

export function ThresholdForm({ value, editable }: { value: number; editable: boolean }) {
  const [v, setV] = useState(String(value));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!editable) return <p className="text-sm">Seuil de publication d&apos;un indice global : <strong>{value} évaluations</strong> validées.</p>;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await setMinObservations(Number(v));
        setMsg(r.error ?? "Seuil enregistré.");
      });
    }}>
      <label className="text-sm font-medium">Seuil de publication (évaluations validées)
        <Input type="number" min={1} max={50} value={v} onChange={(e) => setV(e.target.value)} className="w-24" />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>Enregistrer</Button>
      {msg ? <p role="status" className="w-full text-xs text-muted-foreground">{msg}</p> : null}
    </form>
  );
}
