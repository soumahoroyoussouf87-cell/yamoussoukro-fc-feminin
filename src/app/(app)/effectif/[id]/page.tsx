import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Radar, Video, Target, BarChart3, History } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { getClubHeader } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_STATUS_LABELS, AVAILABILITY_LABELS, DOC_KIND_LABELS, FOOT_LABELS, REASON_LABELS, availabilityVariant, signPhotos } from "@/lib/data/players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { DocumentActions, DocumentUpload } from "@/components/players/documents";
import { ArchiveButton } from "@/components/players/archive-button";
import { AvailabilityForm } from "@/components/players/availability-form";
import { ageFrom, formatDate } from "@/lib/utils";
import { getMinObservations, getPublishedVersion, loadObservations } from "@/lib/performance/data";
import { aggregatePlayer, DIMENSIONS as PERF_DIMENSIONS } from "@/lib/performance/engine";

export const metadata = { title: "Fiche joueuse" };

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

const DIMENSIONS = ["Technique", "Tactique", "Athlétique", "Cognitive", "Mentale", "Comportementale"];

export default async function PlayerPage({ params, searchParams }: PageProps<"/effectif/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission("players.read");
  const supabase = await createClient();
  const club = await getClubHeader(ctx);

  const { data: p } = await supabase
    .from("players")
    .select("*, player_positions(is_primary, positions(code, label, sort_order))")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [photos, { data: seasons }, { data: availability }, { data: docs }] = await Promise.all([
    signPhotos("player-photos", [p.photo_path]),
    supabase.from("player_seasons").select("shirt_number, tactical_role, status, seasons(label), teams(name)").eq("player_id", id),
    can(ctx, "availability.read")
      ? supabase.from("player_availability").select("*").eq("player_id", id).order("starts_on", { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
    can(ctx, "players.documents.read")
      ? supabase.from("player_documents").select("id, kind, title, expires_on, created_at").eq("player_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const positions = [...p.player_positions].sort((a, b) => (a.positions?.sort_order ?? 0) - (b.positions?.sort_order ?? 0));
  const primary = positions.find((x) => x.is_primary)?.positions;
  const current = seasons?.find((s) => s.seasons?.label === club.season?.label);
  const today = new Date().toISOString().slice(0, 10);
  const currentAvail = availability?.find((a) => a.starts_on <= today && (!a.ended_on || a.ended_on >= today));
  const status = currentAvail?.status ?? "disponible";

  return (
    <div className="flex flex-col gap-4">
      {sp.ok ? <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm font-medium text-success">Fiche {sp.ok === "cree" ? "créée" : "mise à jour"} avec succès.</p> : null}

      <section className="hero-gradient flex flex-col gap-6 rounded-2xl p-6 text-white md:flex-row md:items-center">
        <PlayerAvatar src={p.photo_path ? photos.get(p.photo_path) : null} first={p.first_name} last={p.last_name} size={120} className="ring-4 ring-fuchsia/60" />
        <div className="flex-1">
          <p className="font-display text-5xl font-extrabold leading-none text-fuchsia">{current?.shirt_number ? `N°${current.shirt_number}` : ""}</p>
          <h1 className="font-display text-4xl font-bold uppercase leading-tight">{p.first_name} {p.last_name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {primary ? <Badge className="bg-fuchsia text-white">{primary.label}</Badge> : <Badge variant="outline" className="text-white/70">Poste non renseigné</Badge>}
            {can(ctx, "availability.read") ? <Badge variant={availabilityVariant(status)}>{AVAILABILITY_LABELS[status]}</Badge> : null}
            {p.archived_at ? <Badge variant="danger">Archivée</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(ctx, "players.write") ? (
            <Button asChild variant="secondary"><Link href={`/effectif/${id}/modifier`}><Pencil />Modifier</Link></Button>
          ) : null}
          {can(ctx, "players.delete") ? <ArchiveButton id={id} archived={!!p.archived_at} /> : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Date de naissance" value={p.birth_date ? `${formatDate(p.birth_date)} (${ageFrom(p.birth_date)} ans)` : null} />
              <Info label="Nationalité" value={p.nationality} />
              <Info label="Taille" value={p.height_cm ? `${p.height_cm} cm` : null} />
              <Info label="Pied fort" value={p.preferred_foot ? FOOT_LABELS[p.preferred_foot] : null} />
              <Info label="Poste principal" value={primary ? `${primary.code} — ${primary.label}` : null} />
              <Info label="Postes secondaires" value={positions.filter((x) => !x.is_primary).map((x) => x.positions?.code).join(", ")} />
              <Info label="Rôle tactique" value={current?.tactical_role} />
              <Info label="Date d'intégration" value={p.joined_on ? formatDate(p.joined_on) : null} />
              <Info label="Statut administratif" value={ADMIN_STATUS_LABELS[p.admin_status]} />
              <Info label="Licence" value={p.licence_number} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Historique des saisons</CardTitle></CardHeader>
          <CardContent>
            {seasons?.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {seasons.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2 rounded-md bg-muted px-3 py-2">
                    <span>{s.seasons?.label} · {s.teams?.name}</span>
                    <span className="font-semibold">{s.shirt_number ? `N°${s.shirt_number}` : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="Aucune saison" description="La joueuse est inscrite automatiquement sur la saison active lors de l'enregistrement de sa fiche." />
            )}
          </CardContent>
        </Card>
      </div>

      {availability ? (
        <Card id="disponibilite">
          <CardHeader><CardTitle className="text-base">Disponibilité sportive</CardTitle></CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              {availability.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {availability.map((a) => (
                    <li key={a.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={availabilityVariant(a.status)}>{AVAILABILITY_LABELS[a.status]}</Badge>
                        <span className="text-xs text-muted-foreground">
                          du {formatDate(a.starts_on)}{a.ended_on ? ` au ${formatDate(a.ended_on)}` : a.expected_end_on ? ` · retour prévu ${formatDate(a.expected_end_on)}` : " · en cours"}
                        </span>
                      </div>
                      {a.reason ? <p className="mt-1 text-xs">Motif : {REASON_LABELS[a.reason]}</p> : null}
                      {a.sporting_note ? <p className="mt-1 text-xs text-muted-foreground">{a.sporting_note}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune déclaration : la joueuse est considérée disponible.</p>
              )}
            </div>
            {can(ctx, "availability.write") ? <AvailabilityForm players={[{ id, name: `${p.first_name} ${p.last_name}` }]} fixedPlayer /> : null}
          </CardContent>
        </Card>
      ) : null}

      {docs ? (
        <Card id="documents">
          <CardHeader><CardTitle className="text-base">Documents administratifs</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {docs.length ? (
              <ul className="divide-y rounded-md border">
                {docs.map((d) => {
                  const expired = d.expires_on && d.expires_on < today;
                  return (
                    <li key={d.id} className="flex items-center gap-3 p-3 text-sm">
                      <FileText className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">
                        <span className="font-semibold">{d.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{DOC_KIND_LABELS[d.kind]}</span>
                      </span>
                      {d.expires_on ? <Badge variant={expired ? "danger" : "outline"}>{expired ? "Expiré" : "Expire"} le {formatDate(d.expires_on)}</Badge> : null}
                      <DocumentActions id={d.id} canWrite={can(ctx, "players.documents.write")} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document déposé.</p>
            )}
            {can(ctx, "players.documents.write") ? <DocumentUpload playerId={id} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {can(ctx, "evaluations.read") ? <Profile360 playerId={id} ctx={ctx} /> : (
          <Card>
            <CardHeader><CardTitle className="text-sm">Profil de performance 360°</CardTitle></CardHeader>
            <CardContent><EmptyState icon={Radar} title="Accès réservé" description={DIMENSIONS.join(" · ")} /></CardContent>
          </Card>
        )}
        {[
          { t: "Statistiques sportives", i: BarChart3, ph: 2, d: "Matchs, titularisations, minutes, buts, passes, cartons, présences." },
          { t: "Vidéothèque individuelle", i: Video, ph: 4, d: "Séquences codifiées et playlists autorisées." },
          { t: "Plan de développement", i: Target, ph: 4, d: "Objectifs, exercices correctifs, réévaluations." },
        ].map((b) => (
          <Card key={b.t}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">{b.t}</CardTitle>
              <Badge variant="outline">Phase {b.ph}</Badge>
            </CardHeader>
            <CardContent><EmptyState icon={b.i} title="Non encore disponible" description={b.d} /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function Profile360({ playerId, ctx }: { playerId: string; ctx: Awaited<ReturnType<typeof requirePermission>> }) {
  const [reference, min, { rows, versions }] = await Promise.all([getPublishedVersion(ctx), getMinObservations(ctx), loadObservations(ctx, { playerId })]);
  const x = reference ? aggregatePlayer(rows, versions, reference, min) : null;
  const f = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">Profil de performance 360°</CardTitle>
        <Link href={`/performance/individuelle/${playerId}?periode=tout`} className="text-xs font-semibold text-primary-text hover:underline">Ouvrir</Link>
      </CardHeader>
      <CardContent>
        {!x || x.observations === 0 ? (
          <EmptyState icon={Radar} title="Aucune évaluation validée" description={DIMENSIONS.join(" · ")} />
        ) : (
          <>
            <p className="font-display text-3xl font-bold tabular-nums">{x.ipiStatus === "publie" ? `IPI ${f(x.ipi)}` : <span className="text-sm text-muted-foreground">IPI : données insuffisantes ({x.observations}/{min})</span>}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
              {PERF_DIMENSIONS.map((d) => (
                <div key={d.code} className="flex justify-between border-b border-dashed py-0.5"><dt>{d.label}</dt><dd className="tabular-nums">{f(x.dims[d.code].index)}</dd></div>
              ))}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
