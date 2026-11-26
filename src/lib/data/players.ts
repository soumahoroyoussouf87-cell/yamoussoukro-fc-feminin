import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";

export const AVAILABILITY_LABELS = {
  disponible: "Disponible",
  incertaine: "Incertaine",
  restreinte: "Restreinte",
  indisponible: "Indisponible",
} as const;

export function availabilityVariant(s: string): "success" | "danger" | "warning" {
  return s === "disponible" ? "success" : s === "indisponible" ? "danger" : "warning";
}

export const REASON_LABELS: Record<string, string> = {
  blessure: "Blessure",
  maladie: "Maladie",
  suspension: "Suspension",
  selection_nationale: "Sélection nationale",
  raison_personnelle: "Raison personnelle",
  administratif: "Administratif",
  scolaire_professionnel: "Scolaire / professionnel",
  autre: "Autre",
};

export const ADMIN_STATUS_LABELS: Record<string, string> = {
  licenciee: "Licenciée",
  en_cours: "Licence en cours",
  non_licenciee: "Non licenciée",
  pret: "Prêt",
  essai: "À l'essai",
  partie: "Partie",
};

export const DOC_KIND_LABELS: Record<string, string> = {
  licence: "Licence",
  piece_identite: "Pièce d'identité",
  certificat_aptitude: "Certificat d'aptitude",
  autorisation_parentale: "Autorisation parentale",
  contrat: "Contrat",
  consentement_image: "Consentement droit à l'image",
  autre: "Autre",
};

export const FOOT_LABELS: Record<string, string> = { droit: "Droit", gauche: "Gauche", deux: "Les deux" };

export async function getPositions() {
  const supabase = await createClient();
  const { data } = await supabase.from("positions").select("id, code, label, line").order("sort_order");
  return data ?? [];
}

/** URLs signées en lot (1 h) pour les photos : une seule requête réseau. */
export async function signPhotos(bucket: "player-photos" | "staff-photos", paths: (string | null)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}

export type SquadRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  admin_status: string;
  photoUrl: string | null;
  shirt_number: number | null;
  primary: { code: string; label: string; line: string } | null;
  secondary: string[];
  availability: keyof typeof AVAILABILITY_LABELS;
  archived: boolean;
};

export async function listSquad(ctx: AccessContext, opts: { archived?: boolean } = {}): Promise<SquadRow[]> {
  const supabase = await createClient();
  const club = await getClubHeader(ctx);
  let q = supabase
    .from("players")
    .select("id, first_name, last_name, birth_date, admin_status, photo_path, archived_at, player_positions(is_primary, positions(code, label, line, sort_order))")
    .eq("club_id", ctx.clubId)
    .order("last_name");
  q = opts.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data: players } = await q;
  const ids = (players ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const [{ data: seasons }, { data: avail }, photos] = await Promise.all([
    club.season
      ? supabase.from("player_seasons").select("player_id, shirt_number").eq("season_id", club.season.id).in("player_id", ids)
      : Promise.resolve({ data: [] as { player_id: string; shirt_number: number | null }[] }),
    ctx.permissions.has("availability.read")
      ? supabase.from("player_current_availability").select("player_id, status").in("player_id", ids)
      : Promise.resolve({ data: [] as { player_id: string; status: string }[] }),
    signPhotos("player-photos", (players ?? []).map((p) => p.photo_path)),
  ]);
  const shirt = new Map((seasons ?? []).map((s) => [s.player_id, s.shirt_number]));
  const av = new Map((avail ?? []).map((a) => [a.player_id, a.status]));

  return (players ?? []).map((p) => {
    const pos = (p.player_positions ?? []) as { is_primary: boolean; positions: { code: string; label: string; line: string; sort_order: number } | null }[];
    const primary = pos.find((x) => x.is_primary)?.positions ?? null;
    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      birth_date: p.birth_date,
      admin_status: p.admin_status,
      photoUrl: p.photo_path ? photos.get(p.photo_path) ?? null : null,
      shirt_number: shirt.get(p.id) ?? null,
      primary: primary ? { code: primary.code, label: primary.label, line: primary.line } : null,
      secondary: pos.filter((x) => !x.is_primary && x.positions).map((x) => x.positions!.code),
      availability: (av.get(p.id) ?? "disponible") as SquadRow["availability"],
      archived: !!p.archived_at,
    };
  });
}
