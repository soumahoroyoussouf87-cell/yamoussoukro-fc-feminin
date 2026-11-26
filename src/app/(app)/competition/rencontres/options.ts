import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getScope } from "@/lib/phase2/data";

export async function matchFormOptions(ctx: AccessContext) {
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const [{ data: opps }, { data: comps }] = await Promise.all([
    supabase.from("opponents").select("id, name").eq("club_id", ctx.clubId).order("name"),
    supabase.from("competitions").select("id, name").eq("season_id", scope.seasonId ?? "00000000-0000-0000-0000-000000000000").order("name"),
  ]);
  return {
    opponents: (opps ?? []).map((o) => ({ value: o.id, label: o.name })),
    competitions: (comps ?? []).map((c) => ({ value: c.id, label: c.name })),
  };
}
