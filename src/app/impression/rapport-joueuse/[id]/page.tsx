import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { periods as listPeriods } from "@/lib/performance/data";
import { CONTEXT_LABELS, DIMENSIONS, fmtDelta, FRAMEWORK_KEY_LABELS, levelOf } from "@/lib/performance/engine";
import { loadPlayerReport } from "@/lib/reports/data";
import { pickPeriod } from "@/components/performance/period-picker";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";

export const metadata = { title: "Rapport individuel" };

const f = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const d = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");
const RELIABILITY: Record<string, string> = { insuffisante: "insuffisante", faible: "faible", moyenne: "moyenne", elevee: "élevée" };

export default async function PlayerReport({ params, searchParams }: PageProps<"/impression/rapport-joueuse/[id]">) {
  const ctx = await requirePermission("evaluations.read");
  const { id } = await params;
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const period = pickPeriod(await listPeriods(ctx, today), sp.periode);
  const r = await loadPlayerReport(ctx, id, period);
  if (!r) notFound();
  const { player: p, primary, x, dev, reference, min } = r;
  const name = `${p.last_name.toUpperCase()} ${p.first_name}`;
  return (
    <>
      <PrintToolbar filename={`rapport-${p.last_name.toLowerCase()}-${period.key}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Rapport individuel" subtitle={`${name} · ${primary?.label ?? "Poste non renseigné"}`} reference={`Période : ${period.label}`} />
        {!x || !reference || (x.observations === 0 && x.testSessions === 0) ? (
          <p>Aucune évaluation ni séance de tests validée sur la période.</p>
        ) : (
          <>
            <table className="mb-4">
              <tbody>
                <tr><th style={{ width: "34%" }}>Indice de performance individuelle (IPI)</th><td>{x.ipiStatus === "publie" ? <strong>{f(x.ipi)} / 100 · {levelOf(x.ipi)}</strong> : `Données insuffisantes (${x.observations}/${min} évaluations validées)`}</td></tr>
                <tr><th>Évaluée comme</th><td>{x.frameworkKey ? FRAMEWORK_KEY_LABELS[x.frameworkKey] : "—"} · référentiel v{reference.versionNo}</td></tr>
                <tr><th>Évaluations validées</th><td>{x.observations} (du {d(x.from)} au {d(x.to)}) · {x.testSessions} séance(s) de tests</td></tr>
                <tr><th>Couverture et fiabilité</th><td>{Math.round(x.coverage * 100)} % des critères du poste observés · fiabilité {RELIABILITY[x.reliability] ?? x.reliability}</td></tr>
                <tr><th>Développement (IDI)</th><td>{dev?.idi == null ? "Pas encore de mesures comparables" : `${fmtDelta(dev.idi)}${dev.relative == null ? "" : ` (${fmtDelta(dev.relative, "%")})`} sur ${dev.comparisons.length} comparaison(s)`}</td></tr>
              </tbody>
            </table>

            <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Profil par dimension</h2>
            <table className="mb-4">
              <thead><tr><th>Dimension</th><th style={{ width: 90 }}>Poids poste</th><th style={{ width: 80 }}>Indice</th><th>Niveau</th><th style={{ width: 70 }}>Éval.</th></tr></thead>
              <tbody>
                {DIMENSIONS.map((dim) => (
                  <tr key={dim.code}>
                    <td>{dim.label}</td>
                    <td>{x.frameworkKey ? `${reference.dimensionWeights[x.frameworkKey]?.[dim.code] ?? 0} %` : "—"}</td>
                    <td><strong>{f(x.dims[dim.code].index)}</strong></td>
                    <td>{x.dims[dim.code].index == null ? "Non évalué" : levelOf(x.dims[dim.code].index)}</td>
                    <td>{x.dims[dim.code].n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {x.technicalSources.length ? <p className="mb-4 text-xs">Technique : {x.technicalSources.map((s) => `${CONTEXT_LABELS[s.context]} ${f(s.index)} (${f(s.effectiveWeight)} %)`).join(" · ")}.</p> : null}

            {r.strengths.length ? (
              <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="font-bold uppercase text-[#07162E]">Critères les mieux notés</h3>
                  <ul className="list-disc pl-5">{r.strengths.map((c) => <li key={c.code}>{c.label} ({c.dimension}) : {f(c.mean)} · {c.n} obs.</li>)}</ul>
                </div>
                {r.workOn.length ? (
                  <div>
                    <h3 className="font-bold uppercase text-[#07162E]">Critères les moins bien notés</h3>
                    <ul className="list-disc pl-5">{r.workOn.map((c) => <li key={c.code}>{c.label} ({c.dimension}) : {f(c.mean)} · {c.n} obs.</li>)}</ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {x.timeline.length ? (
              <>
                <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Historique des évaluations</h2>
                <table className="mb-4">
                  <thead><tr><th style={{ width: 90 }}>Date</th><th>Contexte</th><th style={{ width: 80 }}>Indice</th></tr></thead>
                  <tbody>{x.timeline.map((t) => <tr key={t.id}><td>{d(t.date)}</td><td>{CONTEXT_LABELS[t.context]}</td><td>{f(t.ipi)}</td></tr>)}</tbody>
                </table>
              </>
            ) : null}

            {r.tests.length ? (
              <>
                <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Tests techniques</h2>
                <table className="mb-4">
                  <thead><tr><th style={{ width: 90 }}>Date</th><th>Protocole</th><th>Résultat</th><th style={{ width: 80 }}>Indice</th></tr></thead>
                  <tbody>{r.tests.map((t) => <tr key={t.id}><td>{d(t.date)}</td><td>{t.protocolName} (v{t.protocolVersion})</td><td>{t.measure === "temps" ? `${f(t.valueSeconds)} s` : `${t.successes ?? "—"}/${t.attempts ?? "—"}`}</td><td>{f(t.index)}</td></tr>)}</tbody>
                </table>
              </>
            ) : null}
          </>
        )}
        <p className="mt-4 text-[10px] text-[#667]">Indices calculés uniquement sur les évaluations et tests validés. Les critères non évalués (N/E) n&apos;entrent pas dans le calcul. Ce rapport décrit des observations ; il ne constitue ni un diagnostic médical ni un diagnostic psychologique.</p>
        <DocFooter note="Rapport individuel confidentiel — Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}
