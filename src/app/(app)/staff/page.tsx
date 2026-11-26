import Link from "next/link";
import { Mail, Pencil, Phone, UserCog, UserPlus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/data/players";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { DeleteStaff } from "@/components/staff/delete-staff";

export const metadata = { title: "Staff technique" };

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const ctx = await requirePermission("staff.read");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("*, roles(label, sort_order)")
    .eq("club_id", ctx.clubId)
    .order("last_name");
  const rows = (data ?? []).sort((a, b) => (a.status === "actif" ? 0 : 1) - (b.status === "actif" ? 0 : 1) || (a.roles?.sort_order ?? 0) - (b.roles?.sort_order ?? 0));
  const photos = await signPhotos("staff-photos", rows.map((r) => r.photo_path));
  const write = can(ctx, "staff.write");

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title="Staff technique"
        description={`${rows.filter((r) => r.status === "actif").length} membre(s) actif(s).`}
        actions={write ? <Button asChild><Link href="/staff/nouveau"><UserPlus />Ajouter un membre</Link></Button> : null}
      />
      {sp.ok ? <p role="status" className="mb-4 rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success">Fiche enregistrée.</p> : null}
      {rows.length === 0 ? (
        <Card className="p-4"><EmptyState icon={UserCog} title="Aucun membre du staff" description="Ajoutez l'entraîneur principal, les adjoints, l'analyste vidéo, le préparateur athlétique…" /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <Card key={s.id} className="flex gap-4 p-4">
              <PlayerAvatar src={s.photo_path ? photos.get(s.photo_path) : null} first={s.first_name} last={s.last_name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.first_name} {s.last_name}</p>
                <p className="text-sm text-primary-text">{s.roles?.label}</p>
                <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {s.email ? <a className="flex items-center gap-1 hover:underline" href={`mailto:${s.email}`}><Mail className="size-3" />{s.email}</a> : null}
                  {s.phone ? <a className="flex items-center gap-1 hover:underline" href={`tel:${s.phone}`}><Phone className="size-3" />{s.phone}</a> : null}
                </div>
                {s.status !== "actif" ? <Badge variant="outline" className="mt-2">{s.status === "parti" ? "Parti" : "Inactif"}</Badge> : null}
              </div>
              {write ? (
                <div className="flex flex-col items-end gap-1">
                  <Button asChild variant="ghost" size="sm"><Link href={`/staff/${s.id}/modifier`} aria-label="Modifier"><Pencil /></Link></Button>
                  <DeleteStaff id={s.id} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
