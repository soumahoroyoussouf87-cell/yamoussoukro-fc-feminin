import { Check, Minus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rôles et permissions" };

export default async function RolesPage() {
  await requirePermission("roles.read");
  const supabase = await createClient();
  const [{ data: roles }, { data: perms }, { data: links }] = await Promise.all([
    supabase.from("roles").select("id, code, label, description").order("sort_order"),
    supabase.from("permissions").select("id, code, module, label, is_sensitive, phase").order("phase").order("module").order("code"),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);
  const has = new Set((links ?? []).map((l) => `${l.role_id}:${l.permission_id}`));

  return (
    <>
      <PageHeader eyebrow="Administration" title="Rôles et permissions" description="Matrice appliquée côté serveur et en base (Row Level Security). Elle évolue par migration versionnée et auditée." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(roles ?? []).map((r) => (
          <Card key={r.id} className="p-4">
            <p className="font-semibold">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.description}</p>
          </Card>
        ))}
      </div>
      <Card id="matrice" className="overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b">
              <th className="p-2 text-left">Permission</th>
              {(roles ?? []).map((r) => <th key={r.id} className="p-2 text-center font-semibold" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{r.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(perms ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-accent/50">
                <td className="p-2">
                  <span className="font-medium">{p.label}</span>{" "}
                  <code className="text-muted-foreground">{p.code}</code>{" "}
                  {p.is_sensitive ? <Badge variant="warning">sensible</Badge> : null}{" "}
                  <Badge variant="outline">P{p.phase}</Badge>
                </td>
                {(roles ?? []).map((r) => (
                  <td key={r.id} className="p-2 text-center">
                    {has.has(`${r.id}:${p.id}`) ? <Check className="mx-auto size-4 text-success" aria-label="Autorisé" /> : <Minus className="mx-auto size-3 text-muted-foreground/40" aria-label="Non autorisé" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
