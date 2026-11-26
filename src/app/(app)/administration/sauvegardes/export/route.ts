import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "clubs", "teams", "seasons", "competitions", "application_settings", "players", "player_seasons", "player_positions",
  "player_availability", "player_documents", "staff_members", "opponents", "matches", "user_roles",
] as const;

/** Export JSON des données du club, lu avec la session de l'administrateur (RLS appliquée). */
export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx?.permissions.has("backups.manage")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const supabase = await createClient();
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), club_id: ctx.clubId, exported_by: ctx.userId, format_version: 1 };
  for (const t of TABLES) {
    // Requête générique sur une liste fermée de tables : typage relâché volontairement.
    const query = supabase.from(t).select("*") as unknown as { eq: (c: string, v: string) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await query.eq(t === "clubs" ? "id" : "club_id", ctx.clubId);
    out[t] = error ? { error: error.message } : data;
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="yfc-hpc-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
