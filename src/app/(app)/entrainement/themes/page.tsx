import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { ThemesManager } from "@/components/training/themes-manager";

export const metadata = { title: "Thèmes d'entraînement" };

export default async function ThemesPage() {
  const ctx = await requirePermission("planning.read");
  const supabase = await createClient();
  const [{ data: themes }, { data: sessions }] = await Promise.all([
    supabase.from("training_themes").select("id, name, parent_id, archived_at").eq("club_id", ctx.clubId).order("name"),
    supabase.from("training_sessions").select("theme_id, sub_theme_id").eq("club_id", ctx.clubId),
  ]);
  const usage: Record<string, number> = {};
  for (const s of sessions ?? []) for (const id of [s.theme_id, s.sub_theme_id]) if (id) usage[id] = (usage[id] ?? 0) + 1;
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Thèmes et sous-thèmes" description="Bibliothèque commune du staff. Un thème archivé n'est plus proposé mais reste sur les anciennes séances." />
      <ThemesManager themes={(themes ?? []).map((t) => ({ id: t.id, name: t.name, parent_id: t.parent_id, archived: !!t.archived_at }))} usage={usage} canWrite={can(ctx, "planning.write")} />
    </>
  );
}
