import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getStaffRoles } from "@/lib/data/staff";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { saveStaff } from "../../actions";

export const metadata = { title: "Modifier un membre du staff" };

export default async function EditStaffPage({ params }: PageProps<"/staff/[id]/modifier">) {
  const { id } = await params;
  await requirePermission("staff.write");
  const supabase = await createClient();
  const [roles, { data }] = await Promise.all([getStaffRoles(), supabase.from("staff_members").select("*").eq("id", id).maybeSingle()]);
  if (!data) notFound();
  return (
    <>
      <PageHeader eyebrow="Staff" title={`Modifier — ${data.first_name} ${data.last_name}`} />
      <StaffForm action={saveStaff.bind(null, id)} roles={roles} initial={data} submitLabel="Enregistrer" />
    </>
  );
}
