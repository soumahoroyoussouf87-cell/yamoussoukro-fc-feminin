import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches } from "@/lib/phase2/data";
import { loadAgenda, itemTime } from "@/lib/phase2/agenda";
import { addDays, matchDayLabel, mondayOf, weekDays } from "@/lib/domain/match-day";
import { dayOf, dayShort, INTENSITY_LABELS, todayIso, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";

export const metadata = { title: "Programme hebdomadaire" };

export default async function PrintProgramme({ searchParams }: PageProps<"/impression/programme">) {
  const ctx = await requirePermission("planning.read");
  const sp = await searchParams;
  const monday = mondayOf(typeof sp.semaine === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine) ? sp.semaine : todayIso());
  const sunday = addDays(monday, 6);
  const scope = await getScope(ctx);
  const supabase = await createClient();
  const [items, around, { data: micro }] = await Promise.all([
    loadAgenda(ctx, monday, sunday),
    listMatches(ctx, { from: addDays(monday, -2), to: addDays(sunday, 6) }),
    scope.teamId ? supabase.from("microcycles").select("label, objective, status").eq("team_id", scope.teamId).eq("week_start", monday).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const matchDates = around.filter((m) => m.status !== "annule" && m.status !== "reporte").map((m) => dayOf(m.kickoff_at));
  return (
    <>
      <PrintToolbar filename={`programme-${monday}`} landscape />
      <div id="document" className="print-sheet landscape">
        <DocHeader title="Programme hebdomadaire" subtitle={`Semaine du ${dayShort(monday)} au ${dayShort(sunday)}${micro?.label ? ` · ${micro.label}` : ""}`} reference={micro ? `Statut : ${WORKFLOW_LABELS[micro.status]}` : "Microcycle non ouvert"} />
        {micro?.objective ? <p className="mb-3 text-sm"><strong>Objectif de la semaine :</strong> {micro.objective}</p> : null}
        <table>
          <thead><tr>{weekDays(monday).map((d) => <th key={d} className="capitalize">{dayShort(d)} <span className="text-[#d1005a]">{matchDayLabel(d, matchDates) ?? ""}</span></th>)}</tr></thead>
          <tbody>
            <tr>
              {weekDays(monday).map((d) => (
                <td key={d} style={{ width: `${100 / 7}%`, height: 300 }}>
                  {items.filter((i) => i.date === d).map((i) => (
                    <div key={i.kind + i.id} className={`mb-1.5 border-l-4 pl-1 ${i.kind === "match" ? "border-[#1f4aa8]" : i.kind === "seance" ? "border-[#ff0068]" : "border-[#999]"}`}>
                      <p className="font-bold">{itemTime(i)}</p>
                      <p>{i.title}</p>
                      {i.subtitle ? <p className="text-[#667]">{i.subtitle}</p> : null}
                      {i.intensity ? <p className="text-[9px] uppercase">Intensité {INTENSITY_LABELS[i.intensity]}</p> : null}
                    </div>
                  ))}
                  {items.every((i) => i.date !== d) ? <p className="text-[#999]">Repos / libre</p> : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-[#667]">J = jour de match · J-n = n jours avant la rencontre · J+1 / J+2 = récupération.</p>
        <DocFooter />
      </div>
    </>
  );
}
