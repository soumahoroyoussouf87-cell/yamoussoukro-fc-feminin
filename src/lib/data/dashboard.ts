import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import type { ClubHeader } from "@/lib/club";
import { computeMatchRecord, type MatchRecord } from "@/lib/domain/match-record";

export type DashboardData = {
  squadTotal: number;
  squadScope: "saison" | "club";
  availability: Record<"disponible" | "incertaine" | "restreinte" | "indisponible", number>;
  lines: { line: string; label: string; count: number }[];
  withoutPosition: number;
  record: MatchRecord | null;
  nextMatch: { kickoff_at: string; opponent: string; opponentLogo: string | null; home_away: string; venue: string | null } | null;
  alerts: { level: "danger" | "warning"; text: string; href: string }[];
  staffActive: number;
};

const LINE_LABELS: Record<string, string> = {
  gardienne: "Gardiennes",
  defense: "Défense",
  milieu: "Milieu",
  attaque: "Attaque",
};

export async function getDashboardData(ctx: AccessContext, club: ClubHeader): Promise<DashboardData> {
  const supabase = await createClient();
  const canPlayers = ctx.permissions.has("players.read");
  const canMatches = ctx.permissions.has("matches.read");
  const canDocs = ctx.permissions.has("players.documents.read");
  const canAvail = ctx.permissions.has("availability.read");

  // Effectif de référence : joueuses inscrites dans la saison active (équipe par défaut),
  // sinon toutes les joueuses actives du club.
  let playerIds: string[] = [];
  let squadScope: DashboardData["squadScope"] = "club";
  if (canPlayers) {
    if (club.season && club.defaultTeamId) {
      const { data } = await supabase
        .from("player_seasons")
        .select("player_id, players!inner(archived_at)")
        .eq("season_id", club.season.id)
        .eq("team_id", club.defaultTeamId)
        .neq("status", "partie")
        .is("players.archived_at", null);
      playerIds = (data ?? []).map((r) => r.player_id);
      squadScope = "saison";
    } else {
      const { data } = await supabase.from("players").select("id").eq("club_id", ctx.clubId).is("archived_at", null);
      playerIds = (data ?? []).map((r) => r.id);
    }
  }

  const availability = { disponible: 0, incertaine: 0, restreinte: 0, indisponible: 0 };
  const alerts: DashboardData["alerts"] = [];
  const lines = Object.entries(LINE_LABELS).map(([line, label]) => ({ line, label, count: 0 }));
  let withoutPosition = 0;

  if (playerIds.length) {
    const [{ data: avail }, { data: positions }, { data: admin }] = await Promise.all([
      canAvail
        ? supabase.from("player_current_availability").select("player_id, status, expected_end_on").in("player_id", playerIds)
        : Promise.resolve({ data: [] as { player_id: string; status: keyof typeof availability; expected_end_on: string | null }[] }),
      supabase.from("player_positions").select("player_id, positions(line)").eq("is_primary", true).in("player_id", playerIds),
      supabase.from("players").select("id, first_name, last_name, admin_status").in("id", playerIds),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    for (const a of avail ?? []) {
      availability[a.status as keyof typeof availability]++;
      if (a.status !== "disponible" && a.expected_end_on && a.expected_end_on < today) {
        alerts.push({ level: "warning", text: "Date de retour prévue dépassée : disponibilité à mettre à jour", href: `/effectif/${a.player_id}` });
      }
    }
    const withLine = new Set<string>();
    for (const p of positions ?? []) {
      const line = (p.positions as { line: string } | null)?.line;
      const entry = lines.find((l) => l.line === line);
      if (entry) entry.count++;
      withLine.add(p.player_id);
    }
    withoutPosition = playerIds.filter((id) => !withLine.has(id)).length;
    if (withoutPosition) {
      alerts.push({ level: "warning", text: `${withoutPosition} joueuse(s) sans poste principal renseigné`, href: "/effectif?filtre=sans-poste" });
    }
    const unlicensed = (admin ?? []).filter((p) => p.admin_status === "en_cours" || p.admin_status === "non_licenciee");
    if (unlicensed.length) {
      alerts.push({ level: "danger", text: `${unlicensed.length} joueuse(s) sans licence validée`, href: "/effectif?filtre=licence" });
    }
  }

  if (canDocs) {
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const { data: docs } = await supabase
      .from("player_documents")
      .select("id, title, expires_on, player_id")
      .eq("club_id", ctx.clubId)
      .not("expires_on", "is", null)
      .lte("expires_on", in30)
      .order("expires_on");
    for (const d of docs ?? []) {
      alerts.push({ level: "danger", text: `Document « ${d.title} » expiré ou expirant le ${d.expires_on}`, href: `/effectif/${d.player_id}#documents` });
    }
  }

  let record: MatchRecord | null = null;
  let nextMatch: DashboardData["nextMatch"] = null;
  if (canMatches && club.season) {
    const { data: matches } = await supabase
      .from("matches")
      .select("status, goals_for, goals_against, kickoff_at, home_away, venue, competition_id, opponents(name, logo_path)")
      .eq("season_id", club.season.id)
      .order("kickoff_at");
    const scoped = (matches ?? []).filter((m) => !club.competition || m.competition_id === club.competition.id);
    record = computeMatchRecord(scoped);
    const upcoming = (matches ?? []).find((m) => m.status === "programme" && m.kickoff_at >= new Date().toISOString());
    if (upcoming) {
      nextMatch = {
        kickoff_at: upcoming.kickoff_at,
        opponent: (upcoming.opponents as { name: string } | null)?.name ?? "Adversaire",
        opponentLogo: (upcoming.opponents as { logo_path: string | null } | null)?.logo_path ?? null,
        home_away: upcoming.home_away,
        venue: upcoming.venue,
      };
    }
  }

  let staffActive = 0;
  if (ctx.permissions.has("staff.read")) {
    const { count } = await supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.clubId)
      .eq("status", "actif");
    staffActive = count ?? 0;
  }

  return { squadTotal: playerIds.length, squadScope, availability, lines, withoutPosition, record, nextMatch, alerts, staffActive };
}
