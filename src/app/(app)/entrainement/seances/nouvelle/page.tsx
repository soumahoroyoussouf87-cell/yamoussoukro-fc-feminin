import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/phase2/labels";
import { createSessionAndOpen } from "@/lib/training/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/phase2/notice";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage({ searchParams }: PageProps<"/entrainement/seances/nouvelle">) {
  const ctx = await requirePermission("planning.write");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIso();
  const supabase = await createClient();
  const { data: templates } = await supabase.from("session_templates").select("id, name, description").eq("club_id", ctx.clubId).order("name");
  const preset = typeof sp.modele === "string" ? sp.modele : "";
  return (
    <>
      <PageHeader eyebrow="Entraînement" title="Nouvelle séance" description="Choisis la date, et éventuellement un modèle. La fiche s'ouvre ensuite en 8 étapes, enregistrées automatiquement." />
      {typeof sp.erreur === "string" ? <Notice tone="danger">{sp.erreur}</Notice> : null}
      <Card className="max-w-xl">
        <CardContent className="pt-5">
          <form action={createSessionAndOpen} className="flex flex-col gap-4">
            <Field label="Date de la séance" htmlFor="date"><Input id="date" name="date" type="date" required defaultValue={date} /></Field>
            <Field label="Partir d'un modèle" htmlFor="templateId" hint={(templates ?? []).length ? "Phases, exercices, schémas et matériel du modèle sont recopiés." : "Aucun modèle pour l'instant : enregistre une séance comme modèle à l'étape 8."}>
              <Select id="templateId" name="templateId" defaultValue={preset}>
                <option value="">Séance vierge</option>
                {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button type="submit">Créer la séance</Button>
              <Button asChild variant="ghost"><Link href="/entrainement/seances">Annuler</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
