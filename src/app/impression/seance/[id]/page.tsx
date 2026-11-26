import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BLOCK_LABELS, CATEGORY_LABELS, dayLong, hm, INTENSITY_LABELS, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";

export const metadata = { title: "Fiche de séance" };

export default async function PrintSession({ params }: PageProps<"/impression/seance/[id]">) {
  await requirePermission("planning.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select("*, staff_members(first_name, last_name), session_exercises(*, exercises(title, category, organisation, instructions, dimensions, players_count))")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const items = [...(s.session_exercises ?? [])];
  const blocks = Object.keys(BLOCK_LABELS).filter((b) => items.some((i) => i.block === b));
  const total = items.reduce((a, i) => a + (i.duration_min ?? 0), 0);
  const head: [string, string | null][] = [
    ["Date", dayLong(s.session_date)], ["Horaires", [hm(s.starts_at), hm(s.ends_at)].filter(Boolean).join(" – ") || null], ["Lieu", s.location],
    ["Intensité", s.intensity ? INTENSITY_LABELS[s.intensity] : null], ["Système", s.game_system], ["Public", s.audience],
    ["Responsable", s.staff_members ? `${s.staff_members.first_name} ${s.staff_members.last_name}` : null], ["Durée totale", total ? `${total} min` : null],
  ];
  return (
    <>
      <PrintToolbar filename={`seance-${s.number}`} />
      <div id="document" className="print-sheet">
        <DocHeader title={`Séance n°${s.number}`} subtitle={`${s.theme}${s.sub_theme ? ` · ${s.sub_theme}` : ""}`} reference={`Statut : ${WORKFLOW_LABELS[s.status]}`} />
        <table className="mb-3"><tbody>
          {Array.from({ length: Math.ceil(head.length / 2) }, (_, r) => (
            <tr key={r}>{head.slice(r * 2, r * 2 + 2).map(([k, v]) => [<th key={k + "h"} style={{ width: "16%" }}>{k}</th>, <td key={k}>{v ?? "—"}</td>])}</tr>
          ))}
        </tbody></table>
        {s.main_objective ? <p className="mb-1 text-sm"><strong>Objectif principal :</strong> {s.main_objective}</p> : null}
        {s.secondary_objectives ? <p className="mb-1 whitespace-pre-line text-xs"><strong>Objectifs secondaires :</strong> {s.secondary_objectives}</p> : null}
        {s.equipment ? <p className="mb-3 whitespace-pre-line text-xs"><strong>Matériel :</strong> {s.equipment}</p> : null}
        <table>
          <thead><tr><th style={{ width: "16%" }}>Bloc</th><th>Exercice et consignes</th><th style={{ width: "13%" }}>Organisation</th><th style={{ width: "9%" }}>Durée</th></tr></thead>
          <tbody>
            {blocks.flatMap((b) => items.filter((i) => i.block === b).sort((x, y) => x.sort_order - y.sort_order).map((i, k) => (
              <tr key={i.id}>
                {k === 0 ? <td rowSpan={items.filter((x) => x.block === b).length} className="font-bold">{BLOCK_LABELS[b]}</td> : null}
                <td>
                  <p className="font-bold">{i.exercises?.title} <span className="font-normal text-[#667]">({i.exercises ? CATEGORY_LABELS[i.exercises.category] : ""})</span></p>
                  {i.exercises?.organisation ? <p className="whitespace-pre-line">{i.exercises.organisation}</p> : null}
                  {i.exercises?.instructions ? <p className="whitespace-pre-line"><em>Consignes :</em> {i.exercises.instructions}</p> : null}
                  {i.notes ? <p><em>Spécifique :</em> {i.notes}</p> : null}
                </td>
                <td>{[i.exercises?.dimensions, i.exercises?.players_count, i.repetitions, i.recovery ? `récup. ${i.recovery}` : null].filter(Boolean).join(" · ")}</td>
                <td>{i.duration_min ? `${i.duration_min}'` : ""}</td>
              </tr>
            )))}
            {items.length === 0 ? <tr><td colSpan={4}>Aucun exercice.</td></tr> : null}
          </tbody>
        </table>
        {s.notes ? <p className="mt-3 whitespace-pre-line text-xs"><strong>Remarques :</strong> {s.notes}</p> : null}
        <DocFooter />
      </div>
    </>
  );
}
