import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  clubId: string;
  clubName: string;
  roleCode: string;
  roleLabel: string;
};

export type AccessContext = {
  userId: string;
  email: string | null;
  fullName: string;
  theme: "dark" | "light";
  clubId: string;
  clubName: string;
  roles: Membership[];
  permissions: Set<string>;
  isStaff: boolean;
};

/**
 * Data Access Layer : identité + club + permissions effectives, résolus une
 * seule fois par requête. Les permissions viennent de la base (user_roles),
 * jamais des métadonnées du compte. Elles servent à adapter l'interface ;
 * la sécurité réelle est appliquée par la RLS.
 */
export const getAccessContext = cache(async (): Promise<AccessContext | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase.rpc("my_memberships"),
    supabase.from("profiles").select("full_name, theme").eq("id", user.id).maybeSingle(),
  ]);

  const roles: Membership[] = (memberships ?? []).map((m) => ({
    clubId: m.club_id,
    clubName: m.club_name,
    roleCode: m.role_code,
    roleLabel: m.role_label,
  }));
  const club = roles[0];
  let permissions = new Set<string>();
  if (club) {
    const { data: perms } = await supabase.rpc("my_permissions", { p_club: club.clubId });
    permissions = new Set((perms ?? []) as string[]);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name || user.email || "Utilisateur",
    theme: profile?.theme === "light" ? "light" : "dark",
    clubId: club?.clubId ?? "",
    clubName: club?.clubName ?? "",
    roles: roles.filter((r) => r.clubId === club?.clubId),
    permissions,
    isStaff: roles.some((r) => r.roleCode !== "player"),
  };
});

/** Exige une session ; redirige vers la connexion sinon. */
export async function requireUser(): Promise<AccessContext> {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/connexion");
  return ctx;
}

/** Exige un compte staff rattaché à un club. */
export async function requireStaff(): Promise<AccessContext> {
  const ctx = await requireUser();
  if (!ctx.clubId) redirect("/acces-en-attente");
  if (!ctx.isStaff) redirect("/espace-joueuse");
  return ctx;
}

/** Exige une permission précise ; sinon page « accès refusé ». */
export async function requirePermission(permission: string): Promise<AccessContext> {
  const ctx = await requireStaff();
  if (!ctx.permissions.has(permission)) redirect(`/acces-refuse?permission=${encodeURIComponent(permission)}`);
  return ctx;
}

export function can(ctx: AccessContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}
