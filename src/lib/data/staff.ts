import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getStaffRoles() {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id, code, label").eq("is_staff", true).order("sort_order");
  return data ?? [];
}
