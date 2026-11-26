"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WORKFLOW_LABELS, WORKFLOW_NEXT, workflowVariant } from "@/lib/phase2/labels";

/** Statut Brouillon → Soumis → Validé → Publié → Archivé, avec les transitions autorisées pour l'utilisateur. */
export function WorkflowBar({
  status, canWrite, canValidate, onChange, validateHint,
}: {
  status: string;
  canWrite: boolean;
  canValidate: boolean;
  onChange: (to: string) => Promise<{ error?: string } | void>;
  validateHint?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = (WORKFLOW_NEXT[status] ?? []).filter((t) => (t.validate ? canValidate : canWrite));
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</span>
        <Badge variant={workflowVariant(status)}>{WORKFLOW_LABELS[status] ?? status}</Badge>
        <span className="flex-1" />
        {next.map((t) => (
          <Button
            key={t.to}
            type="button"
            size="sm"
            variant={t.to === "brouillon" ? "outline" : t.to === "archive" ? "secondary" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await onChange(t.to);
                if (r && r.error) setError(r.error);
              })
            }
          >
            {t.label}
          </Button>
        ))}
      </div>
      {!canValidate && status !== "publie" ? (
        <p className="text-xs text-muted-foreground">{validateHint ?? "La validation et la publication sont réservées à l'entraîneur principal et à la direction sportive."}</p>
      ) : null}
      {error ? <p role="alert" className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
