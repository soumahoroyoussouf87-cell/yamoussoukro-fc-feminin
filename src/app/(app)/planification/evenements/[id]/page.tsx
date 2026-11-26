import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listStaffOptions } from "@/lib/phase2/data";
import { dayLong, EVENT_TYPE_LABELS, hm, INTENSITY_LABELS } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AutoForm } from "@/components/phase2/auto-form";
import { ActionButton } from "@/components/phase2/action-button";
import { deleteEvent, saveEvent } from "../../actions";
import { eventFields } from "../../event-fields";

export const metadata = { title: "Activité" };

export default async function EventPage({ params }: PageProps<"/planification/evenements/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase.from("calendar_events").select("*, staff_members(first_name, last_name)").eq("id", id).maybeSingle();
  if (!e) notFound();
  const write = can(ctx, "planning.write");
  if (!write) {
    const rows: [string, string | null][] = [
      ["Type", EVENT_TYPE_LABELS[e.type]], ["Date", dayLong(e.event_date)], ["Horaires", [hm(e.starts_at), hm(e.ends_at)].filter(Boolean).join(" – ")],
      ["Lieu", e.location], ["Thème", [e.theme, e.sub_theme].filter(Boolean).join(" · ")], ["Intensité", e.intensity ? INTENSITY_LABELS[e.intensity] : null],
      ["Responsable", e.staff_members ? `${e.staff_members.first_name} ${e.staff_members.last_name}` : null], ["Public", e.audience], ["Objectif", e.objective], ["Remarques", e.notes],
    ];
    return (
      <>
        <PageHeader eyebrow="Planification" title={e.title} />
        <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="whitespace-pre-line text-sm">{v}</p></div>)}</CardContent></Card>
      </>
    );
  }
  const staff = await listStaffOptions(ctx);
  return (
    <>
      <PageHeader eyebrow="Planification" title={e.title} actions={<ActionButton action={deleteEvent.bind(null, id)} confirm="Confirmer la suppression">Supprimer</ActionButton>} />
      <AutoForm action={saveEvent.bind(null, id)} fields={eventFields(staff, e as unknown as Record<string, string | null>)} submitLabel="Enregistrer" cancelHref={`/planification/calendrier?date=${e.event_date}`} />
    </>
  );
}
