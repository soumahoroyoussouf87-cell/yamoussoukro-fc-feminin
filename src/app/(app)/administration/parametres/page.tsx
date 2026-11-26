import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivateButton, ClubForm, CompetitionForm, SeasonForm } from "@/components/admin/forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Paramètres" };

const TYPE: Record<string, string> = { championnat: "Championnat", coupe: "Coupe", amical: "Amical", tournoi: "Tournoi", autre: "Autre" };

export default async function SettingsPage() {
  const ctx = await requirePermission("settings.manage");
  const supabase = await createClient();
  const [{ data: club }, { data: settings }, { data: seasons }, { data: teams }] = await Promise.all([
    supabase.from("clubs").select("name, short_name, city").eq("id", ctx.clubId).single(),
    supabase.from("application_settings").select("*").eq("club_id", ctx.clubId).maybeSingle(),
    supabase.from("seasons").select("id, label, starts_on, ends_on, is_active").eq("club_id", ctx.clubId).order("starts_on", { ascending: false }),
    supabase.from("teams").select("id, name").eq("club_id", ctx.clubId).order("is_default", { ascending: false }),
  ]);
  const active = seasons?.find((s) => s.is_active);
  const { data: comps } = active
    ? await supabase.from("competitions").select("id, name, type, squad_size_limit, teams(name)").eq("season_id", active.id).order("name")
    : { data: [] };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Paramètres" description="Identité du club, saisons et compétitions." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Club</CardTitle></CardHeader>
          <CardContent>
            {club ? <ClubForm club={club} minObs={settings?.min_observations_for_index ?? 3} /> : null}
            <p className="mt-4 text-xs text-muted-foreground">Le logo officiel fourni par le club est intégré à l&apos;application sans modification (public/brand/logo-officiel-yfc.png).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Saisons</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {seasons?.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {seasons.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 p-3">
                    <span><strong>{s.label}</strong> <span className="text-muted-foreground">· {formatDate(s.starts_on)} → {formatDate(s.ends_on)}</span></span>
                    {s.is_active ? <Badge variant="success">Active</Badge> : <ActivateButton kind="season" id={s.id} />}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aucune saison. Créez la saison en cours pour activer le suivi.</p>}
            <SeasonForm />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-base">Compétitions de la saison active</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!active ? <p className="text-sm text-muted-foreground">Créez et activez d&apos;abord une saison.</p> : (
              <>
                {comps?.length ? (
                  <ul className="divide-y rounded-md border text-sm">
                    {comps.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 p-3">
                        <span><strong>{c.name}</strong> <span className="text-muted-foreground">· {TYPE[c.type]} · {c.teams?.name} · {c.squad_size_limit} convoquées</span></span>
                        {settings?.active_competition_id === c.id ? <Badge variant="success">Active</Badge> : <ActivateButton kind="competition" id={c.id} />}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Aucune compétition pour {active.label}.</p>}
                <CompetitionForm seasonId={active.id} teams={teams ?? []} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
