"use client";

import { startTransition, useActionState, useState } from "react";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { SQUAD_STATUS_LABELS } from "@/lib/phase2/labels";
import { cn } from "@/lib/utils";

type P = { id: string; name: string; shirt: number | null; position: string | null; availability: string | null };
type Row = { status: string; shirt: number | null; comment: string | null };

export function SquadForm({
  action, players, initial, sizeLimit, notes, readOnly, showComments,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  players: P[];
  initial: Record<string, Row>;
  sizeLimit: number;
  notes: string | null;
  readOnly: boolean;
  showComments: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(players.map((p) => [p.id, initial[p.id]?.status ?? ""])));
  const [limit, setLimit] = useState(sizeLimit);
  const convoked = Object.values(statuses).filter((s) => s === "convoquee").length;
  const over = convoked > limit;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }} className="flex flex-col gap-3">
      {state.error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success">{state.ok}</p> : null}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
        <p className={cn("font-display text-3xl font-bold tabular-nums", over ? "text-danger" : "")} aria-live="polite">{convoked}<span className="text-lg text-muted-foreground">/{limit}</span></p>
        <p className="text-sm text-muted-foreground">joueuses convoquées{over ? " — liste trop longue" : ""}</p>
        <label className="ml-auto flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium">Limite de la feuille de match</span>
          <Input type="number" name="size_limit" min={11} max={40} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 18)} disabled={readOnly} className="h-9 w-24" />
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Joueuse</th><th className="px-3 py-2">Décision</th><th className="px-3 py-2">N°</th>{showComments ? <th className="px-3 py-2">Commentaire confidentiel (staff)</th> : null}</tr>
          </thead>
          <tbody className="divide-y">
            {players.map((p) => (
              <tr key={p.id} className={statuses[p.id] === "convoquee" ? "bg-success/5" : statuses[p.id] === "reserviste" ? "bg-warning/5" : undefined}>
                <td className="px-3 py-2">
                  <span className="font-semibold">{p.name}</span> <span className="text-xs text-muted-foreground">{p.position ?? ""}</span>
                  {p.availability && p.availability !== "disponible" ? <span className="ml-2 rounded bg-warning/15 px-1.5 text-[11px] font-semibold text-warning">{p.availability}</span> : null}
                </td>
                <td className="px-3 py-2">
                  <Select name={`st_${p.id}`} value={statuses[p.id]} onChange={(e) => setStatuses((s) => ({ ...s, [p.id]: e.target.value }))} disabled={readOnly} className="h-9 min-w-40" aria-label={`Décision pour ${p.name}`}>
                    <option value="">—</option>
                    {Object.entries(SQUAD_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </td>
                <td className="px-3 py-2"><Input name={`no_${p.id}`} type="number" min={1} max={99} defaultValue={initial[p.id]?.shirt ?? p.shirt ?? ""} disabled={readOnly} className="h-9 w-20" aria-label={`Numéro de ${p.name}`} /></td>
                {showComments ? <td className="px-3 py-2"><Input name={`cm_${p.id}`} defaultValue={initial[p.id]?.comment ?? ""} maxLength={500} disabled={readOnly} className="h-9" aria-label={`Commentaire confidentiel sur ${p.name}`} /></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notes (visibles du staff)</span>
        <Textarea name="notes" defaultValue={notes ?? ""} maxLength={2000} disabled={readOnly} />
      </label>
      {!readOnly ? <div className="flex justify-end"><Button type="submit" disabled={pending || over}>{pending ? "Enregistrement…" : "Enregistrer la convocation"}</Button></div> : null}
    </form>
  );
}
