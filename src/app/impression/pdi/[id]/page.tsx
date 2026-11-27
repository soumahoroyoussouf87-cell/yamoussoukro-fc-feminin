import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { loadPlan } from "@/lib/development/data";
import { concerned, dayFr } from "@/lib/development/util";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";
import { H } from "@/components/reports/section-title";
import { DECISION_LABELS, OBJ_DIMENSION_LABELS, OBJ_STATUS_LABELS, PLAN_STATUS_LABELS, PRIORITY_LABELS, SCOPE_LABELS } from "@/components/development/labels";

export const metadata = { title: "Plan de développement" };
const fr = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

export default async function PrintPlan({ params }: PageProps<"/impression/pdi/[id]">) {
  const ctx = await requirePermission("development.read");
  const { id } = await params;
  const plan = await loadPlan(ctx, id);
  if (!plan) notFound();
  const last = plan.reviews[0] ?? null;
  return (
    <>
      <PrintToolbar filename={`pdi-${concerned(plan).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`} />
      <div id="document" className="print-sheet">
        <DocHeader title={`Plan de développement ${SCOPE_LABELS[plan.scope].toLowerCase()}`} subtitle={`${concerned(plan)} · ${plan.title}`} reference="Confidentiel staff" />
        <p className="mb-2 text-sm">
          <strong>Période :</strong> du {dayFr(plan.starts_on)} au {dayFr(plan.ends_on)} · <strong>Statut :</strong> {PLAN_STATUS_LABELS[plan.status]}
          {plan.owner ? <> · <strong>Responsable :</strong> {plan.owner}</> : null}
          {plan.status === "actif" && plan.next_review_on ? <> · <strong>Prochaine réévaluation :</strong> {dayFr(plan.next_review_on)}</> : null}
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><H>Constats (faits)</H><p className="whitespace-pre-line">{plan.findings || "—"}</p></div>
          <div><H>Analyse du staff</H><p className="whitespace-pre-line">{plan.analysis || "—"}</p></div>
        </div>
        <H>Objectifs et exercices correctifs</H>
        {!plan.objectives.length ? <p className="text-sm">Aucun objectif.</p> : (
          <table>
            <thead><tr><th>#</th><th>Objectif</th><th>Départ → cible</th><th>Échéance</th><th>Exercices</th><th>Résultat</th></tr></thead>
            <tbody>
              {plan.objectives.map((o, i) => (
                <tr key={o.id}>
                  <td>{i + 1}</td>
                  <td><strong>{o.label}</strong>{o.dimension ? <><br /><span className="text-xs">{OBJ_DIMENSION_LABELS[o.dimension]} · priorité {PRIORITY_LABELS[o.priority].toLowerCase()}</span></> : null}{o.measure ? <><br /><span className="text-xs">Mesure : {o.measure}</span></> : null}</td>
                  <td className="whitespace-nowrap">{fr(o.baseline)} → {fr(o.target)}{o.unit ?? ""}</td>
                  <td className="whitespace-nowrap">{dayFr(o.due_on)}</td>
                  <td>{o.actions.length ? o.actions.map((a) => <div key={a.id}>{a.label}{a.frequency ? ` (${a.frequency})` : ""}</div>) : "—"}</td>
                  <td>{OBJ_STATUS_LABELS[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {last ? (
          <>
            <H>Dernière réévaluation ({dayFr(last.reviewed_on)})</H>
            <p className="text-sm"><strong>Décision :</strong> {DECISION_LABELS[last.decision]}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="font-bold">Faits constatés</p><p className="whitespace-pre-line">{last.facts || "—"}</p></div>
              <div><p className="font-bold">Interprétation du staff</p><p className="whitespace-pre-line">{last.interpretation || "—"}</p></div>
            </div>
          </>
        ) : null}
        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <p className="border-t pt-1">Signature du responsable</p>
          <p className="border-t pt-1">Signature {plan.scope === "individuel" ? "de la joueuse" : "de l'entraîneur principal"}</p>
        </div>
        <DocFooter note="Document confidentiel — staff du Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}
