import Link from "next/link";
import { FolderLock } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DOC_KIND_LABELS } from "@/lib/data/players";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DocumentActions } from "@/components/players/documents";
import { formatDate, isoDay } from "@/lib/utils";

export const metadata = { title: "Documents administratifs" };

export default async function DocumentsPage() {
  const ctx = await requirePermission("players.documents.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_documents")
    .select("id, kind, title, expires_on, created_at, player_id, players(first_name, last_name)")
    .eq("club_id", ctx.clubId)
    .order("expires_on", { ascending: true, nullsFirst: false });
  const today = isoDay();
  const soon = isoDay(30);

  return (
    <>
      <PageHeader eyebrow="Management" title="Documents administratifs" description="Stockage privé. Les téléchargements utilisent des liens temporaires de 5 minutes. Ajoutez un document depuis la fiche de la joueuse." />
      <Card className="p-4">
        {!data?.length ? (
          <EmptyState icon={FolderLock} title="Aucun document" description="Les licences, pièces d'identité, autorisations et consentements déposés apparaîtront ici." />
        ) : (
          <Table>
            <THead><tr><TH>Joueuse</TH><TH>Document</TH><TH>Type</TH><TH>Expiration</TH><TH className="text-right">Actions</TH></tr></THead>
            <TBody>
              {data.map((d) => (
                <TR key={d.id}>
                  <TD><Link className="font-semibold hover:text-primary-text" href={`/effectif/${d.player_id}#documents`}>{d.players?.first_name} {d.players?.last_name}</Link></TD>
                  <TD>{d.title}</TD>
                  <TD className="text-muted-foreground">{DOC_KIND_LABELS[d.kind]}</TD>
                  <TD>
                    {d.expires_on ? (
                      <Badge variant={d.expires_on < today ? "danger" : d.expires_on <= soon ? "warning" : "outline"}>{formatDate(d.expires_on)}</Badge>
                    ) : "—"}
                  </TD>
                  <TD className="text-right"><DocumentActions id={d.id} canWrite={can(ctx, "players.documents.write")} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
