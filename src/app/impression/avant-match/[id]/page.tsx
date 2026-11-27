import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, matchTitle } from "@/lib/phase2/data";
import { dayLong, dayOf, HOME_AWAY_LABELS, timeOf } from "@/lib/phase2/labels";
import { loadOpponent, resultOf } from "@/lib/tactics/data";
import { listSystems, teamIndices } from "@/lib/performance/collective-data";
import { getScope } from "@/lib/phase2/data";
import { FACT_FIELDS, READING_FIELDS, SOURCE_LABELS } from "@/components/tactics/scouting-labels";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { H } from "@/components/reports/section-title";

export const metadata = { title: "Rapport d'avant-match" };

const f = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const d = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

export default async function PreMatchReport({ params }: PageProps<"/impression/avant-match/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m || m.club_id !== ctx.clubId) notFound();
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const [opp, systems, { data: recent }, season] = await Promise.all([
    loadOpponent(ctx, m.opponent_id),
    listSystems(ctx),
    supabase.from("matches").select("id, kickoff_at, status, home_away, goals_for, goals_against, opponents(name)").eq("club_id", ctx.clubId)
      .eq("status", "joue").lt("kickoff_at", m.kickoff_at).order("kickoff_at", { ascending: false }).limit(5),
    scope.club.season ? teamIndices(ctx, { from: scope.club.season.starts_on, to: scope.club.season.ends_on }) : Promise.resolve(null),
  ]);
  const last = opp?.scouting[0] ?? null;
  const ref = systems.find((s) => s.is_reference);
  const day = dayOf(m.kickoff_at);
  return (
    <>
      <PrintToolbar filename={`avant-match-${day}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Rapport d'avant-match" subtitle={`${matchTitle(m)} · ${dayLong(day)} · ${timeOf(m.kickoff_at)}`} reference="Confidentiel staff" />
        <p className="mb-2 text-sm"><strong>Compétition :</strong> {m.competitions?.name ?? "—"}{m.matchday ? ` · ${m.matchday}` : ""} · <strong>Lieu :</strong> {HOME_AWAY_LABELS[m.home_away]}{m.venue ? ` — ${m.venue}` : ""}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <H>Confrontations</H>
            {opp?.h2h.filter((x) => x.status === "joue").length ? (
              <table><tbody>{opp.h2h.filter((x) => x.status === "joue").map((x) => <tr key={x.id}><td>{d(x.date)}</td><td>{HOME_AWAY_LABELS[x.home_away]}</td><td><strong>{resultOf(x)} {x.goals_for}-{x.goals_against}</strong></td></tr>)}</tbody></table>
            ) : <p className="text-sm">Aucune confrontation jouée.</p>}
          </div>
          <div>
            <H>Notre forme (5 derniers)</H>
            {recent?.length ? (
              <table><tbody>{recent.map((x) => <tr key={x.id}><td>{d(x.kickoff_at.slice(0, 10))}</td><td>{(x.opponents as unknown as { name: string } | null)?.name}</td><td><strong>{resultOf(x)} {x.goals_for}-{x.goals_against}</strong></td></tr>)}</tbody></table>
            ) : <p className="text-sm">Aucun match joué.</p>}
          </div>
        </div>

        <H>Adversaire : dernière observation</H>
        {!last ? <p className="text-sm">Aucune fiche d&apos;observation pour cet adversaire.</p> : (
          <>
            <p className="mb-2 text-xs">Observation du {d(last.observed_on)} · {SOURCE_LABELS[last.source]}{last.source_detail ? ` (${last.source_detail})` : ""}{last.author ? ` · par ${last.author}` : ""}{opp && opp.scouting.length > 1 ? ` · ${opp.scouting.length} fiches au total` : ""}</p>
            <table className="mb-2">
              <tbody>
                <tr><th style={{ width: "26%" }}>Système habituel</th><td>{last.usual_system ?? "—"}</td></tr>
                {FACT_FIELDS.map((x) => <tr key={x.key}><th>{x.label}</th><td className="whitespace-pre-line">{last[x.key] ?? "—"}</td></tr>)}
              </tbody>
            </table>
            <p className="mb-1 text-[10px] font-bold uppercase text-[#d1005a]">Lecture du staff (interprétation)</p>
            <table><tbody>{READING_FIELDS.map((x) => <tr key={x.key}><th style={{ width: "26%" }}>{x.label}</th><td className="whitespace-pre-line">{last[x.key] ?? "—"}</td></tr>)}</tbody></table>
          </>
        )}

        <H>Notre équipe</H>
        <table>
          <tbody>
            <tr><th style={{ width: "34%" }}>Système du club</th><td>{ref ? `${ref.name} (base ${ref.base})` : "Non défini"}</td></tr>
            <tr><th>Performance collective (IPC, saison)</th><td>{season?.team?.ipc == null ? `Données insuffisantes (${season?.team?.observations ?? 0} évaluation(s) collective(s) validée(s))` : f(season.team.ipc)}</td></tr>
            <tr><th>Principes à travailler</th><td>{season?.team ? season.team.principles.filter((p) => p.mastered === false).map((p) => p.label).join(", ") || "—" : "—"}</td></tr>
          </tbody>
        </table>
        <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
          {["L'analyste vidéo", "L'entraîneur principal"].map((s) => (
            <div key={s}><p className="font-semibold">{s}</p><p className="text-[10px] text-[#667]">Nom, date et visa</p><div className="mt-12 border-t border-dashed" /></div>
          ))}
        </div>
        <DocFooter note="Rapport d'avant-match confidentiel — ne pas diffuser hors du staff technique." />
      </div>
    </>
  );
}
