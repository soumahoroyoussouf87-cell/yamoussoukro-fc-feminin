import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sauvegardes" };

export default async function BackupsPage() {
  await requirePermission("backups.manage");
  return (
    <>
      <PageHeader eyebrow="Administration" title="Sauvegardes" description="Stratégie de sauvegarde et de restauration (détail dans docs/DEPLOYMENT.md et docs/SECURITY.md)." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Export immédiat des données du club</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Télécharge un fichier JSON contenant les données structurées du club (effectif, staff, saisons, compétitions, disponibilités, métadonnées des documents). Les fichiers (photos, documents) restent dans le stockage privé.</p>
            <p className="text-xs text-muted-foreground">Le fichier contient des données personnelles : conservez-le sur un support chiffré.</p>
            <Button asChild className="self-start"><a href="/administration/sauvegardes/export" download><Download />Exporter (JSON)</a></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sauvegardes automatiques de la base</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>En production, les sauvegardes complètes sont assurées par l&apos;hébergeur de la base (Supabase : sauvegardes quotidiennes sur les offres payantes, restauration à un instant donné en option).</p>
            <p>Une sauvegarde indépendante peut être programmée avec <code>scripts/backup.sh</code> (pg_dump chiffré), à exécuter hors de l&apos;application.</p>
            <p className="text-xs text-muted-foreground">La restauration est une opération d&apos;exploitation (non déclenchable depuis l&apos;interface) suivant la procédure de DEPLOYMENT.md.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
