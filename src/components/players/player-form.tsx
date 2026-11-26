"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { compressInput } from "./compress-image";

type Position = { id: string; code: string; label: string; line: string };
export type PlayerFormValues = {
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  nationality?: string | null;
  height_cm?: number | null;
  preferred_foot?: string | null;
  joined_on?: string | null;
  admin_status?: string;
  licence_number?: string | null;
  shirt_number?: number | null;
  tactical_role?: string | null;
  primary_position?: string | null;
  secondary_positions?: string[];
};

export function PlayerForm({
  action,
  positions,
  initial = {},
  hasSeason,
  cancelHref,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  positions: Position[];
  initial?: PlayerFormValues;
  hasSeason: boolean;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate={false}>
      {state.error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{state.error}</p> : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Identité</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Prénom *" htmlFor="first_name" error={fe.first_name}>
            <Input id="first_name" name="first_name" required defaultValue={initial.first_name} autoComplete="off" />
          </Field>
          <Field label="Nom *" htmlFor="last_name" error={fe.last_name}>
            <Input id="last_name" name="last_name" required defaultValue={initial.last_name} autoComplete="off" />
          </Field>
          <Field label="Date de naissance" htmlFor="birth_date" error={fe.birth_date}>
            <Input id="birth_date" name="birth_date" type="date" defaultValue={initial.birth_date ?? ""} />
          </Field>
          <Field label="Nationalité" htmlFor="nationality" error={fe.nationality}>
            <Input id="nationality" name="nationality" defaultValue={initial.nationality ?? ""} placeholder="Ivoirienne" />
          </Field>
          <Field label="Taille (cm)" htmlFor="height_cm" error={fe.height_cm}>
            <Input id="height_cm" name="height_cm" type="number" min={120} max={220} defaultValue={initial.height_cm ?? ""} />
          </Field>
          <Field label="Pied fort" htmlFor="preferred_foot" error={fe.preferred_foot}>
            <Select id="preferred_foot" name="preferred_foot" defaultValue={initial.preferred_foot ?? ""}>
              <option value="">Non renseigné</option>
              <option value="droit">Droit</option>
              <option value="gauche">Gauche</option>
              <option value="deux">Les deux</option>
            </Select>
          </Field>
          <Field label="Photo officielle" htmlFor="photo" error={fe.photo} hint="PNG, JPEG ou WebP. Réduite automatiquement avant envoi." className="sm:col-span-2 lg:col-span-3">
            <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" onChange={(e) => compressInput(e.currentTarget)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Profil sportif</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Poste principal" htmlFor="primary_position" error={fe.primary_position}>
            <Select id="primary_position" name="primary_position" defaultValue={initial.primary_position ?? ""}>
              <option value="">Non renseigné</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
            </Select>
          </Field>
          <Field label="Numéro de maillot" htmlFor="shirt_number" error={fe.shirt_number} hint={hasSeason ? "Unique pour la saison active" : "Créez d'abord une saison active"}>
            <Input id="shirt_number" name="shirt_number" type="number" min={1} max={99} defaultValue={initial.shirt_number ?? ""} disabled={!hasSeason} />
          </Field>
          <Field label="Rôle tactique" htmlFor="tactical_role" error={fe.tactical_role}>
            <Input id="tactical_role" name="tactical_role" defaultValue={initial.tactical_role ?? ""} placeholder="Ex. : relayeuse box-to-box" disabled={!hasSeason} />
          </Field>
          <fieldset className="sm:col-span-2 lg:col-span-3">
            <legend className="mb-2 text-sm font-medium">Postes secondaires</legend>
            <div className="flex flex-wrap gap-2">
              {positions.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                  <input type="checkbox" name="secondary_positions" value={p.id} defaultChecked={initial.secondary_positions?.includes(p.id)} className="accent-[var(--yfc-fuchsia)]" />
                  {p.code}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Administratif</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Statut administratif *" htmlFor="admin_status" error={fe.admin_status}>
            <Select id="admin_status" name="admin_status" defaultValue={initial.admin_status ?? "en_cours"} required>
              <option value="licenciee">Licenciée</option>
              <option value="en_cours">Licence en cours</option>
              <option value="non_licenciee">Non licenciée</option>
              <option value="pret">Prêt</option>
              <option value="essai">À l&apos;essai</option>
              <option value="partie">Partie</option>
            </Select>
          </Field>
          <Field label="Numéro de licence" htmlFor="licence_number" error={fe.licence_number}>
            <Input id="licence_number" name="licence_number" defaultValue={initial.licence_number ?? ""} />
          </Field>
          <Field label="Date d'intégration" htmlFor="joined_on" error={fe.joined_on}>
            <Input id="joined_on" name="joined_on" type="date" defaultValue={initial.joined_on ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline"><Link href={cancelHref}>Annuler</Link></Button>
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
      </div>
    </form>
  );
}
