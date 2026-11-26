"use client";

import { useActionState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteDocument, documentLink, uploadDocument } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Select } from "@/components/ui/form";

export const DOC_KINDS: [string, string][] = [
  ["licence", "Licence"], ["piece_identite", "Pièce d'identité"], ["certificat_aptitude", "Certificat d'aptitude"],
  ["autorisation_parentale", "Autorisation parentale"], ["contrat", "Contrat"], ["consentement_image", "Consentement droit à l'image"], ["autre", "Autre"],
];

export function DocumentUpload({ playerId }: { playerId: string }) {
  const [state, action, pending] = useActionState(uploadDocument, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      <Field label="Type" htmlFor="kind" error={fe.kind}>
        <Select id="kind" name="kind" required>{DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </Field>
      <Field label="Titre" htmlFor="title" error={fe.title}><Input id="title" name="title" required /></Field>
      <Field label="Date d'expiration" htmlFor="expires_on" error={fe.expires_on}><Input id="expires_on" name="expires_on" type="date" /></Field>
      <Field label="Fichier (PDF, PNG, JPEG — 15 Mo max.)" htmlFor="file" error={fe.file}>
        <Input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required className="h-auto py-2" />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Envoi…" : "Ajouter le document"}</Button>
        {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        {state.ok ? <p role="status" className="text-sm text-success">{state.ok}</p> : null}
      </div>
    </form>
  );
}

export function DocumentActions({ id, canWrite }: { id: string; canWrite: boolean }) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => { const url = await documentLink(id); if (url) window.open(url, "_blank", "noopener"); })}
        aria-label="Télécharger (lien temporaire de 5 minutes)"
      >
        <Download />
      </Button>
      {canWrite ? <ConfirmButton onConfirm={() => deleteDocument(id)} label={<Trash2 aria-label="Supprimer" />} confirmLabel="Supprimer" /> : null}
    </span>
  );
}
