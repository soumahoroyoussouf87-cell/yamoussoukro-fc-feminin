import Link from "next/link";
import { Search } from "lucide-react";
import { can, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Recherche" };

export default async function SearchPage({ searchParams }: PageProps<"/recherche">) {
  const ctx = await requireStaff();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  const supabase = await createClient();
  // Échappement des caractères spéciaux du filtre PostgREST.
  const term = q.replace(/[%_,().*\\]/g, " ").trim();
  const pattern = `%${term}%`;
  const [players, staff] = term.length >= 2
    ? await Promise.all([
        can(ctx, "players.read")
          ? supabase.from("players").select("id, first_name, last_name").eq("club_id", ctx.clubId).or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`).limit(20)
          : Promise.resolve({ data: [] }),
        can(ctx, "staff.read")
          ? supabase.from("staff_members").select("id, first_name, last_name, roles(label)").eq("club_id", ctx.clubId).or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`).limit(20)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];
  const total = (players.data?.length ?? 0) + (staff.data?.length ?? 0);

  return (
    <>
      <PageHeader eyebrow="Recherche globale" title="Recherche" />
      <form className="mb-4 flex max-w-xl gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Nom d'une joueuse ou d'un membre du staff" minLength={2} aria-label="Recherche" />
        <Button type="submit">Rechercher</Button>
      </form>
      {term.length < 2 ? null : total === 0 ? (
        <EmptyState icon={Search} title="Aucun résultat" description={`Aucune fiche ne correspond à « ${q} ».`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {players.data?.length ? (
            <Card className="p-4">
              <h2 className="mb-2 font-display text-lg font-semibold uppercase">Joueuses</h2>
              <ul className="flex flex-col gap-1">{players.data.map((p) => <li key={p.id}><Link className="hover:text-primary-text" href={`/effectif/${p.id}`}>{p.first_name} {p.last_name}</Link></li>)}</ul>
            </Card>
          ) : null}
          {staff.data?.length ? (
            <Card className="p-4">
              <h2 className="mb-2 font-display text-lg font-semibold uppercase">Staff</h2>
              <ul className="flex flex-col gap-1">{staff.data.map((s) => <li key={s.id}><Link className="hover:text-primary-text" href="/staff">{s.first_name} {s.last_name}</Link> <span className="text-xs text-muted-foreground">{(s.roles as { label: string } | null)?.label}</span></li>)}</ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
