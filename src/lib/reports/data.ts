import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getMinObservations, getPublishedVersion, loadObservations, loadTestResults } from "@/lib/performance/data";
import { aggregatePlayer, applicableCriteria, developmentIndex, DIMENSIONS, POSITION_FRAMEWORK_KEY } from "@/lib/performance/engine";

/** Données du rapport individuel : mêmes calculs que le profil 360° (évaluations et tests validés uniquement). */
export async function loadPlayerReport(ctx: AccessContext, id: string, period: { from: string | null; to: string | null }) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: player } = await supabase.from("players")
    .select("id, first_name, last_name, player_positions(is_primary, positions(code, label))").eq("id", id).eq("club_id", ctx.clubId).maybeSingle();
  if (!player) return null;
  const [reference, min, { rows, versions }, tests] = await Promise.all([
    getPublishedVersion(ctx), getMinObservations(ctx), loadObservations(ctx, { playerId: id, from: period.from, to: period.to }),
    loadTestResults(ctx, { playerId: id, from: period.from, to: period.to }),
  ]);
  const primary = (player.player_positions as unknown as { is_primary: boolean; positions: { code: string; label: string } | null }[]).find((p) => p.is_primary)?.positions ?? null;
  const mine = tests.byPlayer.get(id);
  const x = reference ? aggregatePlayer(rows, versions, reference, min, { tests: mine?.sessions, fallbackKey: primary ? POSITION_FRAMEWORK_KEY[primary.code] ?? null : null }) : null;
  const dev = x ? developmentIndex({ tests: mine?.points ?? [], timeline: x.timeline, versionNo: (v) => versions.get(v)?.versionNo }) : null;
  const fk = x?.frameworkKey ?? null;
  // Points forts / axes de travail : critères observés au moins 2 fois (faits notés, pas d'interprétation automatique).
  const crit = reference && fk && x
    ? DIMENSIONS.flatMap((d) => applicableCriteria(reference, fk, d.code).map((c) => ({ code: c.code, label: c.label, dimension: d.label, ...(x.criteria[c.code] ?? { mean: null, n: 0 }) })))
      .filter((c) => c.mean != null && c.n >= 2)
    : [];
  const sorted = [...crit].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
  return {
    player, primary, reference, min, x, dev, tests: mine?.rows ?? [],
    strengths: sorted.slice(0, 3), workOn: sorted.length > 3 ? sorted.slice(-3).reverse() : [],
  };
}
