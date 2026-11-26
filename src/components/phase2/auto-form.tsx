"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };
export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "time" | "datetime-local" | "number" | "select" | "url" | "file" | "hidden";
  options?: Option[];
  required?: boolean;
  defaultValue?: string | number | null;
  span?: 1 | 2 | 3;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  accept?: string;
  rows?: number;
  /** Libellé de l'option vide d'un select (absent = pas d'option vide). */
  emptyOption?: string;
};

/** Formulaire générique : champs déclaratifs, erreurs serveur par champ, message de succès. */
export function AutoForm({
  action, fields, submitLabel, cancelHref, columns = 3, bare = false, footer,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: FieldDef[];
  submitLabel: string;
  cancelHref?: string;
  columns?: 1 | 2 | 3;
  bare?: boolean;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const grid = columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  const span = (s?: number) => (s === 3 ? "sm:col-span-2 lg:col-span-3" : s === 2 ? "sm:col-span-2" : "");

  const body = (
    <div className={cn("grid gap-4", grid)}>
      {fields.map((f) => {
        if (f.type === "hidden") return <input key={f.name} type="hidden" name={f.name} value={f.defaultValue ?? ""} />;
        const common = { id: f.name, name: f.name, required: f.required, placeholder: f.placeholder };
        const dv = f.defaultValue ?? "";
        let control: React.ReactNode;
        if (f.type === "textarea") control = <Textarea {...common} defaultValue={String(dv)} maxLength={f.maxLength} rows={f.rows ?? 3} />;
        else if (f.type === "select")
          control = (
            <Select {...common} defaultValue={String(dv)}>
              {f.emptyOption !== undefined ? <option value="">{f.emptyOption}</option> : null}
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          );
        else if (f.type === "file") control = <Input {...common} type="file" accept={f.accept} className="h-auto py-2" />;
        else
          control = (
            <Input {...common} type={f.type ?? "text"} defaultValue={String(dv)} min={f.min} max={f.max} maxLength={f.maxLength}
              step={f.type === "time" ? 300 : undefined} />
          );
        return (
          <Field key={f.name} label={`${f.label}${f.required ? " *" : ""}`} htmlFor={f.name} error={fe[f.name]} hint={f.hint} className={span(f.span)}>
            {control}
          </Field>
        );
      })}
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }} className="flex flex-col gap-4">
      {state.error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success">{state.ok}</p> : null}
      {bare ? body : <Card><CardContent className="pt-5">{body}</CardContent></Card>}
      {footer}
      <div className="flex justify-end gap-2">
        {cancelHref ? <Button asChild variant="outline"><Link href={cancelHref}>Annuler</Link></Button> : null}
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
      </div>
    </form>
  );
}
