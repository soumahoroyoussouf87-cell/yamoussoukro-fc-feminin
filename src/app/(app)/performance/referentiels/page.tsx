import Link from "next/link";
import { ScrollText } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { getFramework, getMinObservations, loadVersion } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PerfNav } from "@/components/performance/perf-nav";
import { FrameworkEditor } from "@/components/performance/framework-editor";
import { NewVersionForm, ThresholdForm } from "@/components/performance/framework-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Référentiels d'évaluation" };

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  publie: { label: "Publié", variant: "success" },
  brouillon: { label: "Brouillon", variant: "warning" },
  archive: { label: "Archivé", variant: "outline" },
};

export default async function ReferentielsPage() {
  const ctx = await requirePermission("evaluations.read");
  const [fw, min] = await Promise.all([getFramework(ctx), getMinObservations(ctx)]);
  const manage = can(ctx, "frameworks.manage");
  const published = fw?.published ? await loadVersion(fw.published.id) : null;

  return (
    <div>
      <PageHeader eyebrow="Performance" title="Référentiels d'évaluation"
        description="Dimensions, critères observables et pondérations par poste. Une version publiée est figée : la modifier crée une nouvelle version, sans réécrire les évaluations passées." />
      <PerfNav />

      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-display text-lg font-bold uppercase">Versions</h2>
          {fw?.versions.length ? (
            <ul className="divide-y">
              {fw.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Badge variant={STATUS[v.status]?.variant ?? "outline"}>{STATUS[v.status]?.label ?? v.status}</Badge>
                  <Link href={`/performance/referentiels/${v.id}`} className="font-semibold hover:underline">v{v.version_no} · {v.label}</Link>
                  <span className="text-xs text-muted-foreground">{v.published_at ? `publiée le ${formatDate(v.published_at)}` : `créée le ${formatDate(v.created_at)}`}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={ScrollText} title="Aucun référentiel" description="Le référentiel initial est créé avec le club." />}
          {manage && fw?.published ? (
            fw.draft
              ? <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/performance/referentiels/${fw.draft.id}`}>Reprendre le brouillon v{fw.draft.version_no}</Link></Button>
              : <NewVersionForm fromId={fw.published.id} />
          ) : null}
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-display text-lg font-bold uppercase">Échelle et seuil</h2>
          <ul className="mb-3 space-y-0.5 text-sm">
            <li><strong>1</strong> = 20 · Insuffisant</li>
            <li><strong>2</strong> = 40 · En acquisition</li>
            <li><strong>3</strong> = 60 · Acquis</li>
            <li><strong>4</strong> = 80 · Maîtrisé</li>
            <li><strong>5</strong> = 100 · Maîtrise supérieure</li>
            <li><strong>N/E</strong> · Non évalué, ne pénalise jamais</li>
          </ul>
          <ThresholdForm value={min} editable={can(ctx, "settings.manage")} />
          <p className="mt-2 text-xs text-muted-foreground">Technique : tests 20 %, entraînement 30 %, compétition 50 %, renormalisés sur les sources présentes. Les tests techniques arrivent à la livraison suivante.</p>
        </section>
      </div>

      {published ? (
        <>
          <h2 className="mb-3 font-display text-2xl font-bold uppercase">Version publiée · v{published.versionNo} · {published.label}</h2>
          <FrameworkEditor version={published} editable={false} />
        </>
      ) : null}
    </div>
  );
}
