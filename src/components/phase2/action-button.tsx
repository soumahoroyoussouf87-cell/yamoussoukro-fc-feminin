"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Bouton qui appelle une action serveur et affiche son éventuelle erreur. */
export function ActionButton({
  action, children, variant = "outline", size = "sm", confirm,
}: {
  action: () => Promise<{ error?: string } | void>;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "default";
  /** Libellé de confirmation : si présent, un second clic est demandé. */
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const r = await action();
      setArmed(false);
      if (r && r.error) setError(r.error);
    });
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {confirm && armed ? (
        <span className="inline-flex gap-1">
          <Button type="button" size={size} variant="destructive" disabled={pending} onClick={run}>{pending ? "…" : confirm}</Button>
          <Button type="button" size={size} variant="ghost" onClick={() => setArmed(false)}>Annuler</Button>
        </span>
      ) : (
        <Button type="button" size={size} variant={variant} disabled={pending} onClick={() => (confirm ? setArmed(true) : run())}>
          {pending ? "…" : children}
        </Button>
      )}
      {error ? <span role="alert" className="text-xs font-medium text-danger">{error}</span> : null}
    </span>
  );
}
