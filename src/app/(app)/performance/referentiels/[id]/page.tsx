import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/auth";
import { loadVersion } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PerfNav } from "@/components/performance/perf-nav";
import { FrameworkEditor } from "@/components/performance/framework-editor";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Version du référentiel" };

export default async function VersionPage({ params }: PageProps<"/performance/referentiels/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const version = /^[0-9a-f-]{36}$/.test(id) ? await loadVersion(id) : null;
  if (!version) notFound();
  const editable = can(ctx, "frameworks.manage") && version.status === "brouillon";
  return (
    <div>
      <PageHeader eyebrow="Référentiel d'évaluation" title={`v${version.versionNo} · ${version.label}`}
        description={version.status === "publie" ? `Version en vigueur${version.publishedAt ? `, publiée le ${formatDate(version.publishedAt)}` : ""}. Elle est figée.`
          : version.status === "archive" ? "Version archivée : les évaluations réalisées avec elle la conservent." : "Brouillon modifiable."}
        actions={<Button asChild variant="outline"><Link href="/performance/referentiels">Toutes les versions</Link></Button>} />
      <PerfNav />
      <div className="mb-4"><Badge variant={version.status === "publie" ? "success" : version.status === "brouillon" ? "warning" : "outline"}>{version.status === "publie" ? "Publiée" : version.status === "brouillon" ? "Brouillon" : "Archivée"}</Badge></div>
      {version.notes ? <p className="mb-4 text-sm text-muted-foreground">{version.notes}</p> : null}
      <FrameworkEditor version={version} editable={editable} />
    </div>
  );
}
