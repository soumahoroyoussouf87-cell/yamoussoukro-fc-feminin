import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Bibliothèque d'exercices" };

export default async function ExercisesPage({ searchParams }: PageProps<"/entrainement/exercices">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const cat = typeof sp.categorie === "string" && sp.categorie in CATEGORY_LABELS ? sp.categorie : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const archived = sp.archives === "1";
  const supabase = await createClient();
  let query = supabase.from("exercises").select("id, title, category, objective, duration_min, players_count, dimensions, archived_at, diagram_path").eq("club_id", ctx.clubId).order("title");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (cat) query = query.eq("category", cat as never);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const { data: all } = await supabase.from("exercises").select("category").eq("club_id", ctx.clubId).is("archived_at", null);
  const counts = new Map<string, number>();
  for (const e of all ?? []) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);

  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Bibliothèque d'exercices" description={`${(all ?? []).length} exercice(s) actif(s), classés en 15 catégories. Chaque exercice peut être réutilisé dans les fiches de séance.`}
        actions={can(ctx, "planning.write") ? <Button asChild><Link href="/entrainement/exercices/nouveau"><Plus />Nouvel exercice</Link></Button> : null} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Rechercher un exercice…" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select name="categorie" defaultValue={cat} className="w-auto" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l} ({counts.get(k) ?? 0})</option>)}
        </Select>
        {archived ? <input type="hidden" name="archives" value="1" /> : null}
        <Button type="submit" variant="secondary">Filtrer</Button>
        <Button asChild variant="ghost"><Link href={archived ? "/entrainement/exercices" : "/entrainement/exercices?archives=1"}>{archived ? "Exercices actifs" : "Archives"}</Link></Button>
      </form>
      {(data ?? []).length === 0 ? (
        <Card className="p-4"><EmptyState icon={BookOpen} title={q || cat ? "Aucun exercice ne correspond" : "Bibliothèque vide"} description="Ajoutez les exercices du staff : ils seront ensuite sélectionnables dans les fiches de séance." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((e) => (
            <Link key={e.id} href={`/entrainement/exercices/${e.id}`}>
              <Card className="h-full p-4 transition-colors hover:bg-accent/40">
                <Badge variant="secondary">{CATEGORY_LABELS[e.category]}</Badge>
                <p className="mt-2 font-semibold">{e.title}</p>
                {e.objective ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.objective}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{[e.duration_min ? `${e.duration_min} min` : null, e.players_count, e.dimensions, e.diagram_path ? "Schéma" : null].filter(Boolean).join(" · ")}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
