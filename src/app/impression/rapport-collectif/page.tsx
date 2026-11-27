import { requirePermission } from "@/lib/auth";
import { periods as listPeriods } from "@/lib/performance/data";
import { listSystems, teamIndices } from "@/lib/performance/collective-data";
import { MOMENTS, RELATION_LABELS, RELATIONS, SECTORS, SITUATION_LABELS } from "@/lib/performance/collective";
import { fmtDelta, levelOf } from "@/lib/performance/engine";
import { pickPeriod } from "@/components/performance/period-picker";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { H } from "@/components/reports/section-title";

export const metadata = { title: "Rapport collectif" };

const f = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const d = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

export default async function CollectiveReport({ searchParams }: PageProps<"/impression/rapport-collectif">) {
  const ctx = await requirePermission("evaluations.read");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const period = pickPeriod(await listPeriods(ctx, today), sp.periode);
  const [{ reference, min, team, dev }, systems] = await Promise.all([teamIndices(ctx, period), listSystems(ctx)]);
  const ref = systems.find((s) => s.is_reference);
  const work = team?.principles.filter((p) => p.mastered === false) ?? [];
  const good = team?.principles.filter((p) => p.mastered) ?? [];
  return (
    <>
      <PrintToolbar filename={`rapport-collectif-${period.key}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Rapport collectif" subtitle="Performance collective, sectorielle et intersectorielle" reference={`Période : ${period.label}`} />
        {!reference || !team || !dev ? <p>Aucun projet de jeu publié.</p> : team.observations === 0 ? <p>Aucune évaluation collective validée sur la période.</p> : (
          <>
            <table className="mb-2">
              <tbody>
                <tr><th style={{ width: "34%" }}>Évaluations collectives validées</th><td>{team.observations} (du {d(team.from)} au {d(team.to)}) · projet de jeu v{reference.versionNo}{ref ? ` · système du club ${ref.name}` : ""}</td></tr>
                <tr><th>IPC · performance collective</th><td>{team.ipc == null ? `Données insuffisantes (${team.observations}/${min})` : <strong>{f(team.ipc)} · {levelOf(team.ipc)}</strong>}</td></tr>
                <tr><th>IMP · maîtrise du projet de jeu</th><td>{f(team.imp)}{team.imp == null ? "" : " % des principes observés maîtrisés (pondéré par moment)"}</td></tr>
                <tr><th>IPS · performance sectorielle</th><td>{f(team.ips)}</td></tr>
                <tr><th>IPR · performance intersectorielle</th><td>{f(team.ipr)}</td></tr>
                <tr><th>Progression (IDC / IDS)</th><td>{dev.idc == null ? "—" : fmtDelta(dev.idc)} / {dev.ids == null ? "—" : fmtDelta(dev.ids)}</td></tr>
                <tr><th>Principes observés</th><td>{team.evaluatedPrinciples} sur {team.totalPrinciples}</td></tr>
              </tbody>
            </table>
            {!team.enough ? <p className="mb-2 text-xs">Seuil de publication non atteint : les valeurs ci-dessous sont indicatives.</p> : null}

            <H>Moments du jeu</H>
            <table>
              <thead><tr><th>Moment</th><th style={{ width: 70 }}>Poids</th><th style={{ width: 70 }}>Indice</th><th style={{ width: 90 }}>Maîtrise</th><th style={{ width: 60 }}>Éval.</th></tr></thead>
              <tbody>{MOMENTS.map((m) => <tr key={m.code}><td>{m.label}</td><td>{team.moments[m.code]?.weight ?? 0} %</td><td>{f(team.moments[m.code]?.index)}</td><td>{team.mastery[m.code] == null ? "—" : `${f(team.mastery[m.code]!)} %`}</td><td>{team.moments[m.code]?.n ?? 0}</td></tr>)}</tbody>
            </table>

            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div><h3 className="font-bold uppercase text-[#07162E]">Principes maîtrisés (≥ 60)</h3>{good.length ? <ul className="list-disc pl-5">{good.map((p) => <li key={p.code}>{p.label} : {f(p.mean)}</li>)}</ul> : <p>—</p>}</div>
              <div><h3 className="font-bold uppercase text-[#07162E]">Principes à travailler</h3>{work.length ? <ul className="list-disc pl-5">{work.map((p) => <li key={p.code}>{p.label} : {f(p.mean)}</li>)}</ul> : <p>—</p>}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <H>Secteurs</H>
                <table><thead><tr><th>Secteur</th><th style={{ width: 70 }}>Indice</th><th style={{ width: 50 }}>Éval.</th></tr></thead>
                  <tbody>{SECTORS.map((s) => <tr key={s.code}><td>{s.label}</td><td>{f(team.sectors[s.code].index)}</td><td>{team.sectors[s.code].n}</td></tr>)}</tbody></table>
              </div>
              <div>
                <H>Relations entre lignes</H>
                <table><thead><tr><th>Relation</th><th style={{ width: 70 }}>Indice</th><th style={{ width: 50 }}>Éval.</th></tr></thead>
                  <tbody>{RELATIONS.map((s) => <tr key={s.code}><td>{s.label}</td><td>{f(team.relations[s.code].index)}</td><td>{team.relations[s.code].n}</td></tr>)}</tbody></table>
              </div>
            </div>

            {team.measures.length ? (
              <>
                <H>Compacité ({team.compactness.inTarget}/{team.compactness.checked} dans la cible)</H>
                <table><thead><tr><th style={{ width: 80 }}>Date</th><th>Lignes</th><th>Situation</th><th style={{ width: 70 }}>Distance</th><th style={{ width: 80 }}>Cible</th></tr></thead>
                  <tbody>{team.measures.map((m, i) => <tr key={i}><td>{d(m.date)}</td><td>{RELATION_LABELS[m.relation]}</td><td>{SITUATION_LABELS[m.situation]}</td><td>{f(m.distance)} m</td><td>{m.targetMin == null ? "—" : `${f(m.targetMin)}–${f(m.targetMax)} m`}{m.ok == null ? "" : m.ok ? " ✓" : " ✗"}</td></tr>)}</tbody></table>
              </>
            ) : null}
          </>
        )}
        <p className="mt-4 text-[10px] text-[#667]">Indices calculés uniquement à partir des évaluations collectives validées, jamais à partir des notes individuelles. Les critères non observés (N/E) ne pénalisent pas.</p>
        <DocFooter note="Rapport collectif confidentiel — Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}
