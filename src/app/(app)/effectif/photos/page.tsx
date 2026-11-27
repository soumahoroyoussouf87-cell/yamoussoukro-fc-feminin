import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/phase2/data";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoImport, type ImportPlayer } from "./photo-import";

export const metadata = { title: "Importer les photos" };

export default async function PhotoImportPage() {
  const ctx = await requirePermission("players.write");
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const { data: players } = await supabase.from("players").select("id, first_name, last_name, photo_path").eq("club_id", ctx.clubId).is("archived_at", null);
  const { data: seasons } = scope.seasonId
    ? await supabase.from("player_seasons").select("player_id, shirt_number").eq("season_id", scope.seasonId)
    : { data: [] as { player_id: string; shirt_number: number | null }[] };
  const shirt = new Map((seasons ?? []).map((s) => [s.player_id, s.shirt_number]));
  const list: ImportPlayer[] = (players ?? [])
    .map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, shirt: shirt.get(p.id) ?? null, hasPhoto: !!p.photo_path }))
    .sort((a, b) => (a.shirt ?? 999) - (b.shirt ?? 999) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader eyebrow="Management · Effectif" title="Importer les photos" description="Ajoutez les photos de toute l'équipe en une seule fois." />
      <PhotoImport players={list} />
    </>
  );
}
