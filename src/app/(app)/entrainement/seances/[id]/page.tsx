import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, listStaffOptions } from "@/lib/phase2/data";
import { todayIso } from "@/lib/phase2/labels";
import { loadSheet } from "@/lib/training/sheet";
import { SessionWizard } from "@/components/training/wizard";

export const metadata = { title: "Fiche de séance" };

export default async function SessionPage({ params, searchParams }: PageProps<"/entrainement/seances/[id]">) {
  const ctx = await requirePermission("planning.read");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadSheet(ctx, id);
  if (!data) notFound();
  const write = can(ctx, "planning.write");
  const validate = can(ctx, "planning.validate");
  const editable = write && (!["valide", "publie", "archive"].includes(data.session.status) || validate) && data.session.status !== "archive";
  const supabase = await createClient();
  const [history, staff, { data: themes }, { data: library }, { data: templates }] = await Promise.all([
    getApprovalHistory("training_sessions", id),
    write ? listStaffOptions(ctx) : Promise.resolve([]),
    supabase.from("training_themes").select("id, name, parent_id, archived_at").eq("club_id", ctx.clubId).order("name"),
    editable
      ? supabase.from("exercises").select("id, title, category, duration_min").eq("club_id", ctx.clubId).is("archived_at", null).order("category").order("title")
      : Promise.resolve({ data: [] as { id: string; title: string; category: string; duration_min: number | null }[] }),
    write ? supabase.from("session_templates").select("id, name").eq("club_id", ctx.clubId).order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const raw = Number(Array.isArray(sp.etape) ? sp.etape[0] : sp.etape);
  const step = raw >= 1 && raw <= 8 ? Math.floor(raw) : data.session.wizard_step || 1;
  return (
    <SessionWizard
      data={data}
      step={step}
      today={todayIso()}
      perms={{ write, validate, editable, export: can(ctx, "planning.export") }}
      staff={staff.map((s) => ({ value: s.value, label: s.label }))}
      themes={(themes ?? []).map((t) => ({ id: t.id, name: t.name, parent_id: t.parent_id, archived: !!t.archived_at }))}
      library={library ?? []}
      templates={templates ?? []}
      history={history}
      notice={sp.copie ? "Séance dupliquée : vous travaillez sur la nouvelle séance (brouillon)." : sp.nouvelle ? "Séance créée en brouillon. Chaque modification est enregistrée automatiquement." : null}
    />
  );
}
