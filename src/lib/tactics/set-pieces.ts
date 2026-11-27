import type { AccessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDiagram, type Diagram } from "@/lib/training/diagram";
import type { SetPieceCategory } from "@/components/tactics/set-piece-labels";

export type Responsibility = { player_id: string | null; role: string };
export type SetPiece = {
  id: string; category: SetPieceCategory; name: string; side: "gauche" | "droite" | "axe" | "indifferent";
  signal: string | null; instructions: string | null; notes: string | null; diagram: Diagram | null;
  takers: string[]; responsibilities: Responsibility[]; archived: boolean; updated_at: string;
};

const COLS = "id, category, name, side, signal, instructions, notes, diagram, takers, responsibilities, archived_at, sort_order, updated_at";

type Row = { id: string; category: string; name: string; side: string; signal: string | null; instructions: string | null; notes: string | null; diagram: unknown; takers: string[]; responsibilities: unknown; archived_at: string | null; updated_at: string };

function toSetPiece(r: Row): SetPiece {
  const resp = Array.isArray(r.responsibilities) ? (r.responsibilities as Responsibility[]) : [];
  return {
    id: r.id, category: r.category as SetPieceCategory, name: r.name, side: r.side as SetPiece["side"],
    signal: r.signal, instructions: r.instructions, notes: r.notes, diagram: r.diagram ? parseDiagram(r.diagram) : null,
    takers: r.takers ?? [], responsibilities: resp.map((x) => ({ player_id: x.player_id ?? null, role: String(x.role ?? "") })),
    archived: !!r.archived_at, updated_at: r.updated_at,
  };
}

export async function listSetPieces(ctx: AccessContext, opts: { archived?: boolean } = {}): Promise<SetPiece[]> {
  const supabase = await createClient();
  let q = supabase.from("set_piece_routines").select(COLS).eq("club_id", ctx.clubId).order("category").order("sort_order").order("name");
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data } = await q;
  return ((data ?? []) as Row[]).map(toSetPiece);
}

export async function getSetPiece(ctx: AccessContext, id: string): Promise<SetPiece | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("set_piece_routines").select(COLS).eq("id", id).eq("club_id", ctx.clubId).maybeSingle();
  return data ? toSetPiece(data as Row) : null;
}
