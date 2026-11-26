import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { ActionButton } from "@/components/phase2/action-button";
import { deleteCycle, saveMacro, saveMeso } from "../../../actions";
import { macroFields, mesoFields } from "../../fields";

export const metadata = { title: "Modifier un cycle" };

export default async function EditCyclePage({ params }: PageProps<"/planification/cycles/[kind]/[id]">) {
  const ctx = await requirePermission("planning.write");
  const { kind, id } = await params;
  if (kind !== "macro" && kind !== "meso") notFound();
  const supabase = await createClient();
  if (kind === "macro") {
    const { data } = await supabase.from("macrocycles").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    return (
      <>
        <PageHeader eyebrow="Planification" title={`Macrocycle — ${data.name}`} actions={<ActionButton action={deleteCycle.bind(null, "macrocycles", id)} confirm="Supprimer (et ses mésocycles)">Supprimer</ActionButton>} />
        <AutoForm action={saveMacro.bind(null, id)} fields={macroFields(data)} submitLabel="Enregistrer" cancelHref="/planification/cycles" columns={2} />
      </>
    );
  }
  const scope = await getScope(ctx);
  const [{ data }, { data: macros }] = await Promise.all([
    supabase.from("mesocycles").select("*").eq("id", id).maybeSingle(),
    supabase.from("macrocycles").select("id, name").eq("season_id", scope.seasonId ?? "").order("starts_on"),
  ]);
  if (!data) notFound();
  return (
    <>
      <PageHeader eyebrow="Planification" title={`Mésocycle — ${data.name}`} actions={<ActionButton action={deleteCycle.bind(null, "mesocycles", id)} confirm="Confirmer la suppression">Supprimer</ActionButton>} />
      <AutoForm action={saveMeso.bind(null, id)} fields={mesoFields((macros ?? []).map((m) => ({ value: m.id, label: m.name })), data)} submitLabel="Enregistrer" cancelHref="/planification/cycles" columns={2} />
    </>
  );
}
