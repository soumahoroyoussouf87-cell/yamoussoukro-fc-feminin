import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const ctx = await requireStaff();
  return (
    <>
      <PageHeader eyebrow="Profil" title="Mon compte" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Identité</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p><strong>{ctx.fullName}</strong></p>
            <p className="text-muted-foreground">{ctx.email}</p>
            <div className="flex flex-wrap gap-1">{ctx.roles.map((r) => <Badge key={r.roleCode} variant="secondary">{r.roleLabel}</Badge>)}</div>
            <p className="text-xs text-muted-foreground">Club : {ctx.clubName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sécurité</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>{ctx.permissions.size} permission(s) effective(s) via vos rôles.</p>
            <Button asChild variant="outline" className="self-start"><Link href="/definir-mot-de-passe">Changer mon mot de passe</Link></Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
