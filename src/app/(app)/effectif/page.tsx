import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { ADMIN_STATUS_LABELS, AVAILABILITY_LABELS, availabilityVariant, listSquad } from "@/lib/data/players";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { ageFrom } from "@/lib/utils";

export const metadata = { title: "Effectif" };

const LINES = [
  { v: "gardienne", l: "Gardiennes" },
  { v: "defense", l: "Défense" },
  { v: "milieu", l: "Milieu" },
  { v: "attaque", l: "Attaque" },
];

export default async function SquadPage({ searchParams }: PageProps<"/effectif">) {
  const ctx = await requirePermission("players.read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const line = typeof sp.ligne === "string" ? sp.ligne : "";
  const filtre = typeof sp.filtre === "string" ? sp.filtre : "";
  const archived = sp.archives === "1";
  const all = await listSquad(ctx, { archived });

  const rows = all.filter((p) => {
    if (q && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) return false;
    if (line && p.primary?.line !== line) return false;
    if (filtre === "sans-poste" && p.primary) return false;
    if (filtre === "licence" && !["en_cours", "non_licenciee"].includes(p.admin_status)) return false;
    if (filtre === "indisponibles" && p.availability === "disponible") return false;
    return true;
  });
  rows.sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || a.last_name.localeCompare(b.last_name));

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title={archived ? "Effectif — archives" : "Effectif"}
        description={`${all.length} fiche(s) ${archived ? "archivée(s)" : "active(s)"}.`}
        actions={
          can(ctx, "players.write") && !archived ? (
            <Button asChild><Link href="/effectif/nouvelle"><UserPlus />Ajouter une joueuse</Link></Button>
          ) : null
        }
      />
      <Card className="p-4">
        <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_220px_auto_auto]" role="search">
          <label className="sr-only" htmlFor="q">Rechercher</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Rechercher par nom…" />
          <Select name="ligne" defaultValue={line} aria-label="Secteur">
            <option value="">Tous les secteurs</option>
            {LINES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
          </Select>
          <Select name="filtre" defaultValue={filtre} aria-label="Filtre">
            <option value="">Toutes les fiches</option>
            <option value="indisponibles">Non disponibles</option>
            <option value="licence">Licence non validée</option>
            <option value="sans-poste">Sans poste principal</option>
          </Select>
          {archived ? <input type="hidden" name="archives" value="1" /> : null}
          <Button type="submit" variant="secondary">Filtrer</Button>
          <Button asChild variant="ghost"><Link href={archived ? "/effectif" : "/effectif?archives=1"}>{archived ? "Fiches actives" : "Archives"}</Link></Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={all.length ? "Aucun résultat" : "Aucune joueuse enregistrée"}
            description={all.length ? "Modifiez les filtres." : "Créez la première fiche joueuse pour constituer l'effectif."}
          />
        ) : (
          <Table>
            <THead>
              <tr><TH className="w-14">N°</TH><TH>Joueuse</TH><TH>Poste</TH><TH className="hidden md:table-cell">Âge</TH><TH>Disponibilité</TH><TH className="hidden lg:table-cell">Administratif</TH></tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD className="font-display text-xl font-bold tabular-nums">{p.shirt_number ?? "—"}</TD>
                  <TD>
                    <Link href={`/effectif/${p.id}`} className="flex items-center gap-3 font-semibold hover:text-primary-text">
                      <PlayerAvatar src={p.photoUrl} first={p.first_name} last={p.last_name} />
                      <span>{p.first_name} <span className="uppercase">{p.last_name}</span></span>
                    </Link>
                  </TD>
                  <TD>
                    {p.primary ? <Badge variant="secondary" title={p.primary.label}>{p.primary.code}</Badge> : <span className="text-muted-foreground">—</span>}
                    {p.secondary.length ? <span className="ml-1 text-xs text-muted-foreground">{p.secondary.join(", ")}</span> : null}
                  </TD>
                  <TD className="hidden tabular-nums md:table-cell">{ageFrom(p.birth_date) ?? "—"}</TD>
                  <TD><Badge variant={availabilityVariant(p.availability)}>{AVAILABILITY_LABELS[p.availability]}</Badge></TD>
                  <TD className="hidden text-muted-foreground lg:table-cell">{ADMIN_STATUS_LABELS[p.admin_status]}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
