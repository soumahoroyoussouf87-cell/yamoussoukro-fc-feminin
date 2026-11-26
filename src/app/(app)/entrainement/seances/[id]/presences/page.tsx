import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listPlayerOptions } from "@/lib/phase2/data";
import { dayLong } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AttendanceForm } from "@/components/phase2/attendance-form";
import { saveAttendance } from "../../../actions";

export const metadata = { title: "Présences" };

export default async function SessionAttendancePage({ params }: PageProps<"/entrainement/seances/[id]/presences">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions").select("id, number, theme, session_date, training_attendance(player_id, status, note)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const players = await listPlayerOptions(ctx);
  const initial = Object.fromEntries((s.training_attendance ?? []).map((a) => [a.player_id, { status: a.status, note: a.note }]));
  return (
    <>
      <PageHeader eyebrow={`Séance n°${s.number} · ${dayLong(s.session_date)}`} title="Présences" description={s.theme}
        actions={<Button asChild variant="outline"><Link href={`/entrainement/seances/${id}`}>Retour à la séance</Link></Button>} />
      <AttendanceForm action={saveAttendance.bind(null, id)} players={players} initial={initial} readOnly={!can(ctx, "planning.write")} />
    </>
  );
}
