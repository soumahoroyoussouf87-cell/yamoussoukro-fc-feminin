import { z } from "zod";
import type { FormState } from "@/app/(app)/effectif/actions";

export const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
export const optText = (max = 300) => z.preprocess(emptyToNull, z.string().trim().max(max, `${max} caractères maximum`).nullable());
export const optDate = z.preprocess(emptyToNull, z.iso.date("Date invalide").nullable());
export const reqDate = z.iso.date("Date requise");
export const optTime = z.preprocess(emptyToNull, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Heure invalide").nullable());
export const optUuid = z.preprocess(emptyToNull, z.uuid().nullable());
export const optInt = (min: number, max: number) =>
  z.preprocess(emptyToNull, z.coerce.number().int("Nombre entier attendu").min(min, `Minimum ${min}`).max(max, `Maximum ${max}`).nullable());
export const optEnum = <T extends [string, ...string[]]>(values: T) => z.preprocess(emptyToNull, z.enum(values).nullable());

export function zodErrors(e: z.ZodError): FormState {
  const fe: Record<string, string> = {};
  for (const i of e.issues) fe[String(i.path[0])] ??= i.message;
  return { error: "Certains champs sont invalides.", fieldErrors: fe };
}

/** Traduit les erreurs PostgreSQL (triggers / RLS) en message lisible. */
export function dbError(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "42501" && error.message && !/row-level security/.test(error.message)) return error.message;
  if (error.code === "23514" && error.message?.startsWith("Liste complète")) return error.message;
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "42501") return "Action non autorisée pour votre rôle.";
  return fallback;
}
