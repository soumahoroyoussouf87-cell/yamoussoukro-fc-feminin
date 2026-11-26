"use client";

import { useState, useTransition } from "react";
import { Button } from "./button";

/** Action sensible en deux temps : un premier clic arme, un second confirme. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirmer",
  variant = "destructive",
  size = "sm",
}: {
  onConfirm: () => Promise<unknown>;
  label: React.ReactNode;
  confirmLabel?: string;
  variant?: "destructive" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (!armed) return <Button type="button" variant="outline" size={size} onClick={() => setArmed(true)}>{label}</Button>;
  return (
    <span className="inline-flex gap-1">
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => start(async () => { await onConfirm(); setArmed(false); })}>
        {pending ? "…" : confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)}>Annuler</Button>
    </span>
  );
}
