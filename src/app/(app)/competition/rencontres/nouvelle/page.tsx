import { requirePermission } from "@/lib/auth";
import { todayIso } from "@/lib/phase2/labels";
import { PageHeader } from "@/components/ui/page-header";
import { AutoForm } from "@/components/phase2/auto-form";
import { saveMatch } from "../../actions";
import { matchFields } from "../fields";
import { matchFormOptions } from "../options";

export const metadata = { title: "Créer un match" };

export default async function NewMatchPage({ searchParams }: PageProps<"/competition/rencontres/nouvelle">) {
  const ctx = await requirePermission("matches.write");
  const sp = await searchParams;
  const { opponents, competitions } = await matchFormOptions(ctx);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIso();
  return (
    <>
      <PageHeader eyebrow="Compétition" title="Créer un match" description="Le dossier d'avant-match, la convocation, le onze et la délégation se préparent ensuite dans le Match Center." />
      <AutoForm action={saveMatch.bind(null, null)} fields={matchFields(opponents, competitions, { match_date: date })} submitLabel="Créer le match" cancelHref="/competition/rencontres" />
    </>
  );
}
