import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, listPlayerOptions, matchTitle } from "@/lib/phase2/data";
import { dayLong, dayOf, HOME_AWAY_LABELS, timeOf, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { formatDateTime } from "@/lib/utils";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";

export const metadata = { title: "Convocation" };

export default async function PrintSquad({ params }: PageProps<"/impression/convocation/[id]">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const { data: squad } = await supabase.from("match_squads").select("status, size_limit, match_squad_players(player_id, status, shirt_number)").eq("match_id", id).maybeSingle();
  const players = await listPlayerOptions(ctx);
  const byId = new Map(players.map((p) => [p.id, p]));
  const sp = squad?.match_squad_players ?? [];
  const list = (st: string) => sp.filter((p) => p.status === st).map((p) => ({ ...p, pl: byId.get(p.player_id) })).sort((a, b) => (a.pl?.sort ?? 999) - (b.pl?.sort ?? 999));
  const convoked = list("convoquee");
  const reserves = list("reserviste");
  const draft = squad && squad.status !== "valide" && squad.status !== "publie";
  return (
    <>
      <PrintToolbar filename={`convocation-${dayOf(m.kickoff_at)}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Convocation" subtitle={`${matchTitle(m)} · ${m.competitions?.name ?? ""}${m.matchday ? ` · ${m.matchday}` : ""}`} reference={squad ? `Statut : ${WORKFLOW_LABELS[squad.status]}` : undefined} />
        {draft ? <p className="mb-3 rounded bg-[#fff4d6] px-3 py-1.5 text-xs font-bold uppercase text-[#8a5a00]">Document provisoire — non validé</p> : null}
        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <p><strong>Match :</strong> <span className="capitalize">{dayLong(dayOf(m.kickoff_at))}</span> à {timeOf(m.kickoff_at)}</p>
          <p><strong>Lieu :</strong> {HOME_AWAY_LABELS[m.home_away]}{m.venue ? ` — ${m.venue}` : ""}</p>
          <p><strong>Rendez-vous :</strong> {m.meeting_time ? formatDateTime(m.meeting_time) : "À préciser"}</p>
          <p><strong>Lieu de rendez-vous :</strong> {m.meeting_place ?? "À préciser"}</p>
        </div>
        {!squad ? <p className="text-sm">Aucune convocation enregistrée.</p> : (
          <>
            <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Joueuses convoquées ({convoked.length})</h2>
            <table className="mb-4">
              <thead><tr><th style={{ width: 50 }}>N°</th><th>Nom</th><th>Prénom</th><th>Poste</th></tr></thead>
              <tbody>
                {convoked.map((p) => <tr key={p.player_id}><td className="font-bold">{p.shirt_number ?? p.pl?.shirt ?? ""}</td><td className="uppercase">{p.pl?.last_name}</td><td>{p.pl?.first_name}</td><td>{p.pl?.positionLabel ?? ""}</td></tr>)}
              </tbody>
            </table>
            {reserves.length ? (
              <>
                <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Réservistes ({reserves.length})</h2>
                <table className="mb-4"><tbody>{reserves.map((p) => <tr key={p.player_id}><td style={{ width: 50 }}>{p.shirt_number ?? ""}</td><td className="uppercase">{p.pl?.last_name}</td><td>{p.pl?.first_name}</td><td>{p.pl?.positionLabel ?? ""}</td></tr>)}</tbody></table>
              </>
            ) : null}
          </>
        )}
        {m.logistics ? <div className="mb-4 text-sm"><h2 className="font-bold uppercase">Informations pratiques</h2><p className="whitespace-pre-line">{m.logistics}</p></div> : null}
        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div><p className="font-semibold">L&apos;entraîneur principal</p><div className="mt-12 border-t border-dashed" /></div>
          <div><p className="font-semibold">Le Team Manager</p><div className="mt-12 border-t border-dashed" /></div>
        </div>
        <DocFooter />
      </div>
    </>
  );
}
