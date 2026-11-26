"use client";

import { startTransition, useActionState, useRef } from "react";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { ATTENDANCE_LABELS } from "@/lib/phase2/labels";

export function AttendanceForm({
  action, players, initial, readOnly,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  players: { id: string; name: string; shirt: number | null; position: string | null; availability: string | null }[];
  initial: Record<string, { status: string; note: string | null }>;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const setAll = (v: string) => {
    formRef.current?.querySelectorAll<HTMLSelectElement>("select[data-att]").forEach((s) => {
      if (!s.value || v === "") s.value = v;
    });
  };
  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }} className="flex flex-col gap-3">
      {state.error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success">{state.ok}</p> : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAll("present")}>Marquer « présente » les non saisies</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll("")}>Tout effacer</Button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">N°</th><th className="px-3 py-2">Joueuse</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Remarque</th></tr>
          </thead>
          <tbody className="divide-y">
            {players.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-display font-bold">{p.shirt ?? ""}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.position ?? ""}</span>
                  {p.availability && p.availability !== "disponible" ? <span className="ml-2 text-xs text-warning">({p.availability})</span> : null}
                </td>
                <td className="px-3 py-2">
                  <Select name={`status_${p.id}`} data-att defaultValue={initial[p.id]?.status ?? ""} disabled={readOnly} aria-label={`Statut de ${p.name}`} className="h-9 min-w-44">
                    <option value="">— Non saisi</option>
                    {Object.entries(ATTENDANCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input name={`note_${p.id}`} defaultValue={initial[p.id]?.note ?? ""} maxLength={300} disabled={readOnly} aria-label={`Remarque pour ${p.name}`} className="h-9" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly ? <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les présences"}</Button></div> : null}
    </form>
  );
}
