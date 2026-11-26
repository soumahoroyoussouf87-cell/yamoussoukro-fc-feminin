import { requirePermission } from "@/lib/auth";
import { getStaffRoles } from "@/lib/data/staff";
import { PageHeader } from "@/components/ui/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { saveStaff } from "../actions";

export const metadata = { title: "Nouveau membre du staff" };

export default async function NewStaffPage() {
  await requirePermission("staff.write");
  const roles = await getStaffRoles();
  return (
    <>
      <PageHeader eyebrow="Staff" title="Nouveau membre du staff" />
      <StaffForm action={saveStaff.bind(null, null)} roles={roles} submitLabel="Créer la fiche" />
    </>
  );
}
