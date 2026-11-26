"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(app)/effectif/actions";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = z.preprocess(emptyToNull, z.string().trim().max(300).nullable());
const optDate = z.preprocess(emptyToNull, z.iso.date("Date invalide").nullable());

const staffSchema = z
  .object({
    first_name: z.string().trim().min(1, "Prénom requis").max(80),
    last_name: z.string().trim().min(1, "Nom requis").max(80),
    role_id: z.uuid("Fonction requise"),
    email: z.preprocess(emptyToNull, z.email("E-mail invalide").nullable()),
    phone: z.preprocess(emptyToNull, z.string().trim().regex(/^[+0-9 ().-]{6,20}$/, "Téléphone invalide").nullable()),
    qualifications: optText,
    starts_on: optDate,
    ends_on: optDate,
    status: z.enum(["actif", "inactif", "parti"]),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { message: "Doit suivre la date de début", path: ["ends_on"] });

function errors(e: z.ZodError): FormState {
  const fe: Record<string, string> = {};
  for (const i of e.issues) fe[String(i.path[0])] ??= i.message;
  return { error: "Certains champs sont invalides.", fieldErrors: fe };
}

async function photo(clubId: string, staffId: string, file: File | null) {
  if (!file || file.size === 0) return { path: null as string | null };
  if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { error: "Photo invalide (PNG, JPEG, WebP, 5 Mo max.)." };
  const supabase = await createClient();
  const path = `${clubId}/${staffId}/photo-${Date.now()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
  const { error } = await supabase.storage.from("staff-photos").upload(path, file, { contentType: file.type });
  return error ? { error: "Échec de l'envoi de la photo." } : { path };
}

export async function saveStaff(staffId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("staff.write");
  const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return errors(parsed.error);
  const v = { ...parsed.data, last_name: parsed.data.last_name.toUpperCase() };
  const supabase = await createClient();

  // La fonction doit être un rôle staff (pas « joueuse »).
  const { data: role } = await supabase.from("roles").select("is_staff").eq("id", v.role_id).single();
  if (!role?.is_staff) return { error: "Fonction invalide.", fieldErrors: { role_id: "Fonction invalide" } };

  let id = staffId;
  if (!id) {
    const { data, error } = await supabase.from("staff_members").insert({ ...v, club_id: ctx.clubId }).select("id").single();
    if (error || !data) return { error: "Création refusée." };
    id = data.id;
  } else {
    const { data, error } = await supabase.from("staff_members").update(v).eq("id", id).select("id");
    if (error || !data?.length) return { error: "Modification refusée." };
  }
  const ph = await photo(ctx.clubId, id, formData.get("photo") as File | null);
  if ("error" in ph && ph.error) return { error: ph.error, fieldErrors: { photo: ph.error } };
  if (ph.path) await supabase.from("staff_members").update({ photo_path: ph.path }).eq("id", id);

  revalidatePath("/staff");
  redirect("/staff?ok=1");
}

export async function deleteStaff(staffId: string) {
  await requirePermission("staff.write");
  const supabase = await createClient();
  const { data } = await supabase.from("staff_members").delete().eq("id", staffId).select("photo_path");
  if (data?.[0]?.photo_path) await supabase.storage.from("staff-photos").remove([data[0].photo_path]);
  revalidatePath("/staff");
}
