import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listActions } from "@/lib/development/data";
import { concerned } from "@/lib/development/util";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Exercices correctifs" };

export default async function CorrectiveExercisesPage() {
  const ctx = await requirePermission("development.read");
  const actions = await listActions(ctx);
  // Regroupement par exercice de la bibliothèque ; les consignes libres à part.
  const groups = new Map<string, { title: string; exerciseId: string | null; items: typeof actions }>();
  for (const a of actions) {
    const key = a.exercise?.id ?? `libre:${a.label.toLowerCase()}`;
    const g = groups.get(key) ?? { title: a.exercise?.title ?? a.label, exerciseId: a.exercise?.id ?? null, items: [] };
    g.items.push(a);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title, "fr"));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Développement" title="Exercices correctifs" description="Exercices prescrits dans les plans en cours, regroupés pour préparer les séances : qui travaille quoi, à quelle fréquence." />
      {!list.length ? <EmptyState icon={Dumbbell} title="Aucun exercice prescrit" description="Les exercices se prescrivent sur chaque objectif d'un plan." /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((g) => (
            <Card key={g.title + g.exerciseId} className="p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{g.exerciseId ? <Link href={`/entrainement/exercices/${g.exerciseId}`} className="hover:underline">{g.title}</Link> : g.title}</h2>
                <span className="text-xs text-muted-foreground">{g.exerciseId ? "Bibliothèque" : "Consigne libre"} · {g.items.length} prescription{g.items.length > 1 ? "s" : ""}</span>
              </div>
              <ul className="space-y-1 text-sm">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/developpement/${a.plan.id}#objectif-${a.objective.id}`} className="font-medium hover:underline">{concerned(a.plan)}</Link>
                    <span className="text-muted-foreground"> — {a.objective.label}{a.frequency ? ` · ${a.frequency}` : ""}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
