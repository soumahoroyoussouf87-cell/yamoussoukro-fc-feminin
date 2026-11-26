import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InviteForm, RevokeButton } from "@/components/admin/forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const ctx = await requirePermission("users.manage");
  const supabase = await createClient();
  const [{ data: grants }, { data: roles }, { data: players }] = await Promise.all([
    supabase.from("user_roles").select("id, user_id, granted_at, revoked_at, roles(label, code)").eq("club_id", ctx.clubId).order("granted_at", { ascending: false }),
    supabase.from("roles").select("id, code, label").order("sort_order"),
    supabase.from("players").select("id, first_name, last_name").eq("club_id", ctx.clubId).is("profile_id", null).is("archived_at", null).order("last_name"),
  ]);
  const ids = [...new Set((grants ?? []).map((g) => g.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const active = (grants ?? []).filter((g) => !g.revoked_at);
  const revoked = (grants ?? []).filter((g) => g.revoked_at);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Utilisateurs" description="Les comptes sont créés uniquement sur invitation. Les permissions découlent exclusivement des rôles attribués ici." />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Inviter un utilisateur ou attribuer un rôle</CardTitle>
          <CardDescription>Si l&apos;adresse correspond déjà à un compte, le rôle lui est simplement ajouté.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm roles={roles ?? []} players={(players ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))} />
        </CardContent>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-display text-lg font-semibold uppercase">Rôles actifs ({active.length})</h2>
        <Table>
          <THead><tr><TH>Utilisateur</TH><TH>Rôle</TH><TH>Depuis</TH><TH className="text-right">Action</TH></tr></THead>
          <TBody>
            {active.map((g) => {
              const p = byId.get(g.user_id);
              return (
                <TR key={g.id}>
                  <TD><p className="font-semibold">{p?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{p?.email}</p></TD>
                  <TD><Badge variant={g.roles?.code === "admin" ? "default" : "secondary"}>{g.roles?.label}</Badge></TD>
                  <TD className="text-muted-foreground">{formatDate(g.granted_at)}</TD>
                  <TD className="text-right">{g.user_id === ctx.userId ? <span className="text-xs text-muted-foreground">Vous</span> : <RevokeButton id={g.id} />}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {revoked.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Historique des révocations ({revoked.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {revoked.map((g) => <li key={g.id} className="text-muted-foreground">{byId.get(g.user_id)?.full_name || byId.get(g.user_id)?.email} — {g.roles?.label} — révoqué le {formatDate(g.revoked_at)}</li>)}
            </ul>
          </details>
        ) : null}
      </Card>
    </>
  );
}
