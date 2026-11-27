"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Base = { name: string; label: string; error?: string; hint?: string; disabled?: boolean; className?: string };

export function TextF({ value, onChange, type = "text", maxLength, placeholder, ...b }: Base & { value: string | null; onChange: (v: string) => void; type?: string; maxLength?: number; placeholder?: string }) {
  return (
    <Field label={b.label} htmlFor={b.name} error={b.error} hint={b.hint} className={b.className}>
      <Input id={b.name} name={b.name} type={type} value={value ?? ""} maxLength={maxLength} placeholder={placeholder} disabled={b.disabled} aria-invalid={!!b.error} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function AreaF({ value, onChange, maxLength, rows = 3, placeholder, ...b }: Base & { value: string | null; onChange: (v: string) => void; maxLength?: number; rows?: number; placeholder?: string }) {
  return (
    <Field label={b.label} htmlFor={b.name} error={b.error} hint={b.hint} className={b.className}>
      <Textarea id={b.name} name={b.name} value={value ?? ""} rows={rows} maxLength={maxLength} placeholder={placeholder} disabled={b.disabled} aria-invalid={!!b.error} onChange={(e) => onChange(e.target.value)} />
      {maxLength && (value?.length ?? 0) > maxLength * 0.8 ? <span className="text-right text-[11px] text-muted-foreground">{value?.length ?? 0}/{maxLength}</span> : null}
    </Field>
  );
}

export function NumF({ value, onChange, min, max, step, suffix, ...b }: Base & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <Field label={b.label} htmlFor={b.name} error={b.error} hint={b.hint} className={b.className}>
      <div className="relative">
        <Input id={b.name} name={b.name} type="number" inputMode="numeric" value={value ?? ""} min={min} max={max} step={step ?? 1} disabled={b.disabled} aria-invalid={!!b.error}
          className={cn(suffix && "pr-12")}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function SelectF({ value, onChange, options, empty, ...b }: Base & { value: string | null; onChange: (v: string | null) => void; options: { value: string; label: string }[]; empty?: string }) {
  return (
    <Field label={b.label} htmlFor={b.name} error={b.error} hint={b.hint} className={b.className}>
      <Select id={b.name} name={b.name} value={value ?? ""} disabled={b.disabled} aria-invalid={!!b.error} onChange={(e) => onChange(e.target.value || null)}>
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </Field>
  );
}

/** Convertit une valeur de champ en entier ou null, pour l'envoi au serveur. */
export const intOrNull = (v: number | null) => (v == null || Number.isNaN(v) ? null : Math.round(v));
