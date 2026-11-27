import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateDelete } from "@/components/training/template-delete";

export const metadata = { title: "Modèles de séance" };

type Payload = { session?: { theme?: string | null; main_objective?: string | null }; phases?: { title: string; items?: unknown[] }[]; equipment?: unknown[] };

export default async function TemplatesPage() {
  const ctx = await requirePermission("planning.read");
  const write = can(ctx, "planning.write");
  const supabase = await createClient();
  const { data } = await supabase.from("session_templates").select("id, name, description, payload, created_at").eq("club_id", ctx.clubId).order("name");
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Modèles de séance" description="Un modèle reprend les informations, les phases, les exercices, les schémas et le matériel d'une séance. Crée-le depuis l'étape 8 d'une fiche." />
      {(data ?? []).length === 0 ? <Card className="p-4"><EmptyState icon={LayoutTemplate} title="Aucun modèle" description="Ouvre une fiche de séance, étape 8, puis « Enregistrer comme modèle »." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((t) => {
            const p = t.payload as Payload;
            const exercises = (p.phases ?? []).reduce((a, ph) => a + (ph.items?.length ?? 0), 0);
            return (
              <Card key={t.id} className="flex flex-col gap-2 p-4">
                <p className="font-display text-lg font-bold uppercase">{t.name}</p>
                {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
                <p className="text-xs">{(p.phases ?? []).length} phase(s) · {exercises} exercice(s) · {(p.equipment ?? []).length} matériel(s){p.session?.theme ? ` · ${p.session.theme}` : ""}</p>
                {(p.phases ?? []).length ? <p className="text-xs text-muted-foreground">{(p.phases ?? []).map((ph) => ph.title).join(" → ")}</p> : null}
                <p className="text-[11px] text-muted-foreground">Créé le {formatDateTime(t.created_at)}</p>
                {write ? (
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm"><Link href={`/entrainement/seances/nouvelle?modele=${t.id}`}>Utiliser</Link></Button>
                    <TemplateDelete id={t.id} />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
