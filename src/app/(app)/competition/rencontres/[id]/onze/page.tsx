import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon, Lock, Plus, Printer, Shirt } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions, matchTitle } from "@/lib/phase2/data";
import { LINEUP_STATUS_LABELS } from "@/lib/phase2/labels";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LineupEditor, type LineupInitial } from "@/components/phase2/lineup-editor";
import { ActionButton } from "@/components/phase2/action-button";
import { deleteLineup, saveLineup, setLineupStatus } from "../../../actions";

export const metadata = { title: "Onze de départ" };

export default async function LineupPage({ params, searchParams }: PageProps<"/competition/rencontres/[id]/onze">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const readDraft = can(ctx, "lineups.read_draft");
  const canWrite = can(ctx, "lineups.write") || can(ctx, "lineups.validate");
  const canValidate = can(ctx, "lineups.validate");
  const { data: lineups } = await supabase.from("lineups").select("id, label, system, status, version, instructions, updated_at").eq("match_id", id).order("created_at");
  const list = lineups ?? [];

  if (!readDraft && !list.length) {
    return <Card className="p-4"><EmptyState icon={Lock} title="Composition confidentielle" description="Le onze de départ sera visible ici dès que sa communication aura été autorisée par le staff." /></Card>;
  }

  const wantNew = sp.compo === "nouvelle" && canWrite;
  const current = wantNew ? null : list.find((l) => l.id === sp.compo) ?? list.find((l) => l.status !== "provisoire") ?? list[0] ?? null;
  const [{ data: lp }, { data: squad }, all, { data: snaps }] = await Promise.all([
    current ? supabase.from("lineup_players").select("*").eq("lineup_id", current.id).order("sort_order") : Promise.resolve({ data: [] }),
    supabase.from("match_squads").select("match_squad_players(player_id, status, shirt_number)").eq("match_id", id).maybeSingle(),
    listPlayerOptions(ctx),
    current && readDraft ? supabase.from("lineup_snapshots").select("id, version, status, saved_at").eq("lineup_id", current.id).order("version", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  const squadPlayers = (squad?.match_squad_players ?? []).filter((p) => p.status === "convoquee");
  const squadShirt = new Map(squadPlayers.map((p) => [p.player_id, p.shirt_number]));
  const inSquad = new Set(squadPlayers.map((p) => p.player_id));
  const inLineup = new Set((lp ?? []).map((p) => p.player_id));
  const players = (squadPlayers.length ? all.filter((p) => inSquad.has(p.id) || inLineup.has(p.id)) : all).map((p) => ({
    id: p.id, name: p.name, short: p.short, shirt: squadShirt.get(p.id) ?? p.shirt, position: p.position, availability: p.availability,
  }));
  const initial: LineupInitial = current
    ? { id: current.id, label: current.label, system: current.system, status: current.status, instructions: current.instructions, players: (lp ?? []).map((p) => ({ ...p, x: p.x == null ? null : Number(p.x), y: p.y == null ? null : Number(p.y) })) }
    : { id: null, label: list.length ? `Variante ${list.length + 1}` : "Composition principale", system: "4-3-3", status: "provisoire", instructions: null, players: [] };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {list.map((l) => (
          <Button key={l.id} asChild size="sm" variant={l.id === current?.id ? "secondary" : "ghost"}>
            <Link href={`?compo=${l.id}`}>{l.label} <Badge variant={l.status === "provisoire" ? "warning" : "success"} className="ml-1">{l.status === "provisoire" ? "Provisoire" : LINEUP_STATUS_LABELS[l.status]}</Badge></Link>
          </Button>
        ))}
        {canWrite ? <Button asChild size="sm" variant={wantNew ? "secondary" : "outline"}><Link href="?compo=nouvelle"><Plus />Nouvelle composition</Link></Button> : null}
        <span className="flex-1" />
        {current ? <Button asChild size="sm" variant="outline"><Link href={`/impression/onze/${id}?compo=${current.id}`} target="_blank"><Printer />Imprimer / PDF</Link></Button> : null}
        {current ? <Button asChild size="sm"><Link href={`/impression/affiche-onze/${id}?compo=${current.id}`} target="_blank"><ImageIcon />Affiche du onze</Link></Button> : null}
      </div>
      {readDraft && initial.status === "provisoire" ? (
        <p className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm font-medium text-warning"><Lock className="size-4" />Composition provisoire : confidentielle, jamais officielle tant qu&apos;elle n&apos;est pas validée.</p>
      ) : null}
      {!squadPlayers.length ? <p className="text-xs text-muted-foreground">Aucune convocation enregistrée : toutes les joueuses actives sont proposées.</p> : null}
      {!current && !canWrite ? (
        <Card className="p-4"><EmptyState icon={Shirt} title="Aucune composition" /></Card>
      ) : (
        <LineupEditor
          key={current?.id ?? "new"}
          matchId={id}
          title={matchTitle(m)}
          players={players}
          initial={initial}
          canWrite={canWrite}
          canValidate={canValidate}
          onSave={saveLineup}
          onStatus={current ? setLineupStatus.bind(null, id, current.id) : undefined}
        />
      )}
      {current && (snaps ?? []).length ? (
        <details className="rounded-lg border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Historique des modifications ({(snaps ?? []).length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {(snaps ?? []).map((s) => <li key={s.id}>Version {s.version} · {formatDateTime(s.saved_at)} · {LINEUP_STATUS_LABELS[s.status]}</li>)}
          </ul>
        </details>
      ) : null}
      {current && canWrite && (current.status === "provisoire" || canValidate) ? (
        <div><ActionButton action={deleteLineup.bind(null, id, current.id)} confirm="Supprimer cette composition">Supprimer la composition</ActionButton></div>
      ) : null}
    </div>
  );
}
