import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getScope, listMatches, listPlayerOptions } from "@/lib/phase2/data";
import { periods as listPeriods } from "@/lib/performance/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodPicker, pickPeriod } from "@/components/performance/period-picker";

export const metadata = { title: "Rapports de performance" };

export default async function PerformanceReportsPage({ searchParams }: PageProps<"/rapports/performance">) {
  const ctx = await requirePermission("evaluations.read");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const all = await listPeriods(ctx, today);
  const period = pickPeriod(all, sp.periode);
  const scope = await getScope(ctx);
  const [players, upcoming] = await Promise.all([
    listPlayerOptions(ctx),
    listMatches(ctx, { seasonId: scope.seasonId, from: today }),
  ]);
  const q = `?periode=${period.key}`;
  return (
    <div>
      <PageHeader eyebrow="Rapports" title="Rapports de performance"
        description="Documents aux couleurs du club, construits à partir des données validées. Ouvrez un rapport puis « Imprimer / Enregistrer en PDF » ou « Exporter en PNG »." />
      <PeriodPicker periods={all} current={period.key} base="/rapports/performance" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="collectifs" className="scroll-mt-20">
          <CardHeader><CardTitle className="text-base">Rapport collectif, sectoriel et intersectoriel</CardTitle><CardDescription>IPC, maîtrise du projet de jeu, secteurs, relations entre lignes, compacité · {period.label.toLowerCase()}</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href={`/impression/rapport-collectif${q}`} target="_blank"><Printer />Ouvrir le rapport collectif</Link></Button></CardContent>
        </Card>
        <Card id="bilans" className="scroll-mt-20">
          <CardHeader><CardTitle className="text-base">Bilan périodique</CardTitle><CardDescription>Résultats, présences, évaluations, indicateurs · {period.label.toLowerCase()}. Choisissez « 30 derniers jours » pour un bilan mensuel, la saison pour le bilan annuel.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href={`/impression/bilan${q}`} target="_blank"><Printer />Ouvrir le bilan</Link></Button></CardContent>
        </Card>
        <Card id="avant-match" className="scroll-mt-20">
          <CardHeader><CardTitle className="text-base">Rapports d&apos;avant-match</CardTitle><CardDescription>Confrontations, forme, dernière observation de l&apos;adversaire, plan de jeu.</CardDescription></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Aucun match à venir.</p> : (
              <ul className="divide-y text-sm">
                {upcoming.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>{m.kickoff_at.slice(0, 10).split("-").reverse().join("/")} · {m.opponent}</span>
                    <Link href={`/impression/avant-match/${m.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"><Printer className="size-3" />Ouvrir</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card id="individuels" className="scroll-mt-20 lg:row-span-2">
          <CardHeader><CardTitle className="text-base">Rapports individuels</CardTitle><CardDescription>IPI, profil par dimension, critères les mieux et les moins bien notés, tests, IDI · {period.label.toLowerCase()}</CardDescription></CardHeader>
          <CardContent>
            {players.length === 0 ? <p className="text-sm text-muted-foreground">Aucune joueuse.</p> : (
              <ul className="grid gap-x-4 text-sm sm:grid-cols-2">
                {players.map((p) => (
                  <li key={p.id} className="border-b border-dashed py-1.5">
                    <Link href={`/impression/rapport-joueuse/${p.id}${q}`} target="_blank" className="inline-flex items-center gap-1.5 hover:underline"><FileText className="size-3.5 text-muted-foreground" />{p.shirt ? `${p.shirt}. ` : ""}{p.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
