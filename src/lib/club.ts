import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";

export type ClubHeader = {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  season: { id: string; label: string; starts_on: string; ends_on: string } | null;
  competition: { id: string; name: string; squad_size_limit: number } | null;
  defaultTeamId: string | null;
};

/** En-tête institutionnel : club, logo officiel (URL signée courte), saison et compétition actives. */
export const getClubHeader = cache(async (ctx: AccessContext): Promise<ClubHeader> => {
  const supabase = await createClient();
  const [{ data: club }, { data: settings }] = await Promise.all([
    supabase.from("clubs").select("name, tagline, logo_path").eq("id", ctx.clubId).single(),
    supabase
      .from("application_settings")
      .select("default_team_id, season:seasons!application_settings_active_season_id_fkey(id, label, starts_on, ends_on), competition:competitions!application_settings_active_competition_id_fkey(id, name, squad_size_limit)")
      .eq("club_id", ctx.clubId)
      .maybeSingle(),
  ]);

  let logoUrl: string | null = null;
  if (club?.logo_path) {
    const { data } = await supabase.storage.from("club-assets").createSignedUrl(club.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return {
    name: club?.name ?? ctx.clubName,
    tagline: club?.tagline ?? null,
    logoUrl,
    season: settings?.season ?? null,
    competition: settings?.competition ?? null,
    defaultTeamId: settings?.default_team_id ?? null,
  };
});
