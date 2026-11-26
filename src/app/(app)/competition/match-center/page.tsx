import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getScope, listMatches } from "@/lib/phase2/data";
import { dayOf, todayIso } from "@/lib/phase2/labels";

/** Ouvre le Match Center du prochain match (ou du dernier joué), sinon le calendrier. */
export default async function MatchCenterEntry() {
  const ctx = await requirePermission("matches.read");
  const scope = await getScope(ctx);
  const matches = await listMatches(ctx, { seasonId: scope.seasonId ?? "00000000-0000-0000-0000-000000000000" });
  const today = todayIso();
  const next = matches.find((m) => dayOf(m.kickoff_at) >= today && m.status === "programme") ?? [...matches].reverse().find((m) => m.status === "joue");
  redirect(next ? `/competition/rencontres/${next.id}` : "/competition/rencontres");
}
