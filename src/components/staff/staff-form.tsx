"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { compressInput } from "@/components/players/compress-image";

export type StaffValues = {
  first_name?: string; last_name?: string; role_id?: string; email?: string | null; phone?: string | null;
  qualifications?: string | null; starts_on?: string | null; ends_on?: string | null; status?: string;
};

export function StaffForm({ action, roles, initial = {}, submitLabel }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  roles: { id: string; label: string }[];
  initial?: StaffValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{state.error}</p> : null}
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Prénom *" htmlFor="first_name" error={fe.first_name}><Input id="first_name" name="first_name" required defaultValue={initial.first_name} /></Field>
          <Field label="Nom *" htmlFor="last_name" error={fe.last_name}><Input id="last_name" name="last_name" required defaultValue={initial.last_name} /></Field>
          <Field label="Fonction *" htmlFor="role_id" error={fe.role_id}>
            <Select id="role_id" name="role_id" required defaultValue={initial.role_id ?? ""}>
              <option value="" disabled>Choisir…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="E-mail" htmlFor="email" error={fe.email}><Input id="email" name="email" type="email" defaultValue={initial.email ?? ""} /></Field>
          <Field label="Téléphone" htmlFor="phone" error={fe.phone}><Input id="phone" name="phone" type="tel" defaultValue={initial.phone ?? ""} placeholder="+225 …" /></Field>
          <Field label="Statut" htmlFor="status" error={fe.status}>
            <Select id="status" name="status" defaultValue={initial.status ?? "actif"}>
              <option value="actif">Actif</option><option value="inactif">Inactif</option><option value="parti">Parti</option>
            </Select>
          </Field>
          <Field label="Début de mission" htmlFor="starts_on" error={fe.starts_on}><Input id="starts_on" name="starts_on" type="date" defaultValue={initial.starts_on ?? ""} /></Field>
          <Field label="Fin de mission" htmlFor="ends_on" error={fe.ends_on}><Input id="ends_on" name="ends_on" type="date" defaultValue={initial.ends_on ?? ""} /></Field>
          <Field label="Photo" htmlFor="photo" error={fe.photo}>
            <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" onChange={(e) => compressInput(e.currentTarget)} />
          </Field>
          <Field label="Diplômes et qualifications" htmlFor="qualifications" error={fe.qualifications} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="qualifications" name="qualifications" defaultValue={initial.qualifications ?? ""} maxLength={300} />
          </Field>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">La fiche staff décrit la fonction. L&apos;accès à la plateforme et les permissions se gèrent dans Administration › Utilisateurs.</p>
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline"><Link href="/staff">Annuler</Link></Button>
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
      </div>
    </form>
  );
}
