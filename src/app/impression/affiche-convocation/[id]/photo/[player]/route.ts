import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Photo d'une joueuse pour l'affiche, servie depuis le stockage privé avec la session de l'utilisateur.
 * Même origine que la page : l'export en image (canvas) n'est pas bloqué par le navigateur.
 */
export async function GET(_req: Request, { params }: RouteContext<"/impression/affiche-convocation/[id]/photo/[player]">) {
  await requirePermission("matches.read");
  const { player } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("players").select("photo_path").eq("id", player).maybeSingle();
  if (!p?.photo_path) return new Response(null, { status: 404 });
  const { data } = await supabase.storage.from("player-photos").download(p.photo_path);
  if (!data) return new Response(null, { status: 404 });
  return new Response(data, { headers: { "Content-Type": data.type || "image/webp", "Cache-Control": "private, max-age=600" } });
}
