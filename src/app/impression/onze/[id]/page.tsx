import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions, matchTitle } from "@/lib/phase2/data";
import { dayLong, dayOf, LINEUP_STATUS_LABELS, timeOf } from "@/lib/phase2/labels";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { PitchMarkings } from "@/components/phase2/pitch";

export const metadata = { title: "Onze de départ" };

export default async function PrintLineup({ params, searchParams }: PageProps<"/impression/onze/[id]">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const { data: lineups } = await supabase.from("lineups").select("id, label, system, status, instructions, version").eq("match_id", id);
  const l = (lineups ?? []).find((x) => x.id === sp.compo) ?? (lineups ?? []).find((x) => x.status !== "provisoire") ?? (lineups ?? [])[0];
  if (!l) return <><PrintToolbar filename="onze" /><div id="document" className="print-sheet"><DocHeader title="Onze de départ" /><p>Aucune composition accessible.</p></div></>;
  const [{ data: lp }, players] = await Promise.all([supabase.from("lineup_players").select("*").eq("lineup_id", l.id).order("sort_order"), listPlayerOptions(ctx)]);
  const { data: squad } = await supabase.from("match_squads").select("match_squad_players(player_id, shirt_number)").eq("match_id", id).maybeSingle();
  const shirt = new Map((squad?.match_squad_players ?? []).map((p) => [p.player_id, p.shirt_number]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const starters = (lp ?? []).filter((p) => p.slot === "titulaire");
  const bench = (lp ?? []).filter((p) => p.slot === "remplacante");
  const nm = (pid: string) => byId.get(pid)?.short ?? "";
  const no = (pid: string) => shirt.get(pid) ?? byId.get(pid)?.shirt ?? "";
  const takers = (k: "takes_penalties" | "takes_free_kicks" | "takes_corners") => (lp ?? []).filter((p) => p[k]).map((p) => nm(p.player_id)).join(", ") || "—";
  const captain = (lp ?? []).find((p) => p.is_captain);
  return (
    <>
      <PrintToolbar filename={`onze-${dayOf(m.kickoff_at)}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Onze de départ" subtitle={`${matchTitle(m)} · ${dayLong(dayOf(m.kickoff_at))} · ${timeOf(m.kickoff_at)}`} reference={`${l.label} · v${l.version}`} />
        {l.status === "provisoire" ? <p className="mb-3 rounded bg-[#ffe1ec] px-3 py-1.5 text-xs font-bold uppercase text-[#a0003f]">Composition provisoire — confidentielle, ne pas diffuser</p> : <p className="mb-3 text-xs font-bold uppercase text-[#0a7a3c]">{LINEUP_STATUS_LABELS[l.status]}</p>}
        <div className="grid grid-cols-[1fr_200px] gap-5">
          <div className="relative overflow-hidden rounded" style={{ aspectRatio: "68 / 105" }}>
            <PitchMarkings />
            {starters.map((p) => (
              <div key={p.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${p.x ?? 50}%`, top: `${p.y ?? 50}%` }}>
                <span className={`flex size-10 items-center justify-center rounded-full border-2 border-white font-display font-bold ${p.position_label === "GB" ? "bg-[#f5b700] text-black" : "bg-[#ff0068] text-white"}`}>{no(p.player_id)}</span>
                <span className="mt-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{nm(p.player_id)}{p.is_captain ? " (C)" : ""}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 text-xs">
            <p className="font-display text-2xl font-bold">{l.system}</p>
            <div><h3 className="font-bold uppercase">Titulaires</h3><ol>{starters.map((p) => <li key={p.id}>{no(p.player_id)} · {nm(p.player_id)} <span className="text-[#667]">{p.position_label}</span></li>)}</ol></div>
            <div><h3 className="font-bold uppercase">Remplaçantes</h3><ol>{bench.map((p) => <li key={p.id}>{no(p.player_id)} · {nm(p.player_id)}</li>)}</ol>{bench.length ? null : "—"}</div>
            <div><h3 className="font-bold uppercase">Capitaine</h3><p>{captain ? nm(captain.player_id) : "—"}</p></div>
            <div><h3 className="font-bold uppercase">Coups de pied arrêtés</h3><p>Penalties : {takers("takes_penalties")}</p><p>Coups francs : {takers("takes_free_kicks")}</p><p>Corners : {takers("takes_corners")}</p></div>
          </div>
        </div>
        {l.instructions ? <div className="mt-4 text-xs"><h3 className="font-bold uppercase">Consignes</h3><p className="whitespace-pre-line">{l.instructions}</p></div> : null}
        {(lp ?? []).some((p) => p.responsibilities) ? (
          <div className="mt-3 text-xs"><h3 className="font-bold uppercase">Responsabilités</h3><ul>{(lp ?? []).filter((p) => p.responsibilities).map((p) => <li key={p.id}><strong>{nm(p.player_id)} :</strong> {p.responsibilities}</li>)}</ul></div>
        ) : null}
        <DocFooter />
      </div>
    </>
  );
}
