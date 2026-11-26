"use client";

import { useActionState, useState } from "react";
import { declareAvailability } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export function AvailabilityForm({ players, fixedPlayer = false }: { players: { id: string; name: string }[]; fixedPlayer?: boolean }) {
  const [state, action, pending] = useActionState(declareAvailability, {});
  const [status, setStatus] = useState("indisponible");
  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2">
      <p className="text-sm font-semibold sm:col-span-2">Nouvelle déclaration</p>
      {fixedPlayer ? (
        <input type="hidden" name="player_id" value={players[0]?.id} />
      ) : (
        <Field label="Joueuse" htmlFor="player_id" error={fe.player_id} className="sm:col-span-2">
          <Select id="player_id" name="player_id" required defaultValue="">
            <option value="" disabled>Choisir une joueuse…</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Statut" htmlFor="status" error={fe.status}>
        <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="disponible">Disponible</option>
          <option value="incertaine">Incertaine</option>
          <option value="restreinte">Restreinte</option>
          <option value="indisponible">Indisponible</option>
        </Select>
      </Field>
      <Field label="Motif" htmlFor="reason" error={fe.reason}>
        <Select id="reason" name="reason" disabled={status === "disponible"} defaultValue="">
          <option value="">—</option>
          <option value="blessure">Blessure</option>
          <option value="maladie">Maladie</option>
          <option value="suspension">Suspension</option>
          <option value="selection_nationale">Sélection nationale</option>
          <option value="raison_personnelle">Raison personnelle</option>
          <option value="administratif">Administratif</option>
          <option value="scolaire_professionnel">Scolaire / professionnel</option>
          <option value="autre">Autre</option>
        </Select>
      </Field>
      <Field label="À partir du" htmlFor="starts_on" error={fe.starts_on}>
        <Input id="starts_on" name="starts_on" type="date" defaultValue={today} required />
      </Field>
      <Field label="Retour prévu" htmlFor="expected_end_on" error={fe.expected_end_on}>
        <Input id="expected_end_on" name="expected_end_on" type="date" disabled={status === "disponible"} />
      </Field>
      <Field label="Note sportive (facultative)" htmlFor="sporting_note" error={fe.sporting_note} hint="Aucun diagnostic ni détail médical ici : ils relèvent du dossier médical (Phase 5)." className="sm:col-span-2">
        <Textarea id="sporting_note" name="sporting_note" maxLength={500} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
        {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        {state.ok ? <p role="status" className="text-sm text-success">{state.ok}</p> : null}
      </div>
    </form>
  );
}
