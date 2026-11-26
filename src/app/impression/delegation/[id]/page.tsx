import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatch, matchTitle } from "@/lib/phase2/data";
import { dayLong, dayOf, DELEGATION_GROUP_LABELS, HOME_AWAY_LABELS, timeOf, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { formatDateTime } from "@/lib/utils";
import { PrintToolbar } from "@/components/phase2/print-toolbar";
import { DocFooter, DocHeader } from "@/components/phase2/doc-header";

export const metadata = { title: "Délégation officielle" };

const fcfa = (n: number | null) => (n == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`);

export default async function PrintDelegation({ params }: PageProps<"/impression/delegation/[id]">) {
  await requirePermission("matches.read");
  const { id } = await params;
  const m = await getMatch(id);
  if (!m) notFound();
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("delegations")
    .select("*, head:staff_members!delegations_head_staff_id_fkey(first_name, last_name), delegation_members(id, member_group, external_name, function_label, room, players(first_name, last_name), staff_members(first_name, last_name, roles(label)))")
    .eq("match_id", id)
    .maybeSingle();
  if (!d) return <><PrintToolbar filename="delegation" /><div id="document" className="print-sheet"><DocHeader title="Délégation officielle" /><p>Aucune délégation enregistrée pour ce match.</p></div></>;
  const members = d.delegation_members ?? [];
  const groups = Object.keys(DELEGATION_GROUP_LABELS).filter((g) => members.some((x) => x.member_group === g));
  const name = (x: (typeof members)[number]) => (x.players ? `${x.players.last_name.toUpperCase()} ${x.players.first_name}` : x.staff_members ? `${x.staff_members.last_name.toUpperCase()} ${x.staff_members.first_name}` : x.external_name ?? "");
  const official = d.status === "valide" || d.status === "publie";
  const info: [string, string | null][] = [
    ["Chef de délégation", d.head ? `${d.head.first_name} ${d.head.last_name}` : null], ["Transport", d.transport], ["Chauffeur", d.driver],
    ["Départ", d.departure_at ? formatDateTime(d.departure_at) : null], ["Retour", d.return_at ? formatDateTime(d.return_at) : null],
    ["Hébergement", d.accommodation], ["Restauration", d.catering],
  ];
  return (
    <>
      <PrintToolbar filename={`delegation-${dayOf(m.kickoff_at)}`} />
      <div id="document" className="print-sheet">
        <DocHeader title="Délégation officielle" subtitle={`${matchTitle(m)} · ${dayLong(dayOf(m.kickoff_at))} · ${timeOf(m.kickoff_at)}`} reference={`Statut : ${WORKFLOW_LABELS[d.status]}`} />
        {!official ? <p className="mb-3 rounded bg-[#fff4d6] px-3 py-1.5 text-xs font-bold uppercase text-[#8a5a00]">Document non validé — ne vaut pas délégation officielle</p> : null}
        <p className="mb-3 text-sm"><strong>Compétition :</strong> {m.competitions?.name ?? "—"}{m.matchday ? ` · ${m.matchday}` : ""} · <strong>Lieu :</strong> {HOME_AWAY_LABELS[m.home_away]}{m.venue ? ` — ${m.venue}` : ""}</p>
        <table className="mb-4"><tbody>{info.map(([k, v]) => <tr key={k}><th style={{ width: "28%" }}>{k}</th><td className="whitespace-pre-line">{v ?? "—"}</td></tr>)}</tbody></table>
        <h2 className="mb-1 font-display text-lg font-bold uppercase text-[#07162E]">Composition de la délégation ({members.length})</h2>
        <table className="mb-4">
          <thead><tr><th style={{ width: 30 }}>#</th><th>Nom et prénom</th><th>Fonction</th><th style={{ width: 70 }}>Chambre</th></tr></thead>
          <tbody>
            {groups.flatMap((g) => [
              <tr key={g}><td colSpan={4} className="bg-[#f6f7fb] font-bold uppercase text-[#d1005a]">{DELEGATION_GROUP_LABELS[g]}</td></tr>,
              ...members.filter((x) => x.member_group === g).map((x, i) => (
                <tr key={x.id}><td>{i + 1}</td><td>{name(x)}</td><td>{x.function_label ?? x.staff_members?.roles?.label ?? (g === "joueuse" ? "Joueuse" : "")}</td><td>{x.room ?? ""}</td></tr>
              )),
            ])}
          </tbody>
        </table>
        {d.schedule || d.trip_program ? (
          <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
            {d.schedule ? <div><h3 className="font-bold uppercase">Horaires</h3><p className="whitespace-pre-line">{d.schedule}</p></div> : null}
            {d.trip_program ? <div><h3 className="font-bold uppercase">Programme du déplacement</h3><p className="whitespace-pre-line">{d.trip_program}</p></div> : null}
          </div>
        ) : null}
        {d.equipment ? <div className="mb-4 text-xs"><h3 className="font-bold uppercase">Matériel</h3><p className="whitespace-pre-line">{d.equipment}</p></div> : null}
        <p className="text-xs"><strong>Budget prévu :</strong> {fcfa(d.budget_planned)} · <strong>Budget réel :</strong> {fcfa(d.budget_actual)}</p>
        <div className="mt-10 grid grid-cols-3 gap-6 text-xs">
          {["Le Team Manager", "L'entraîneur principal", "La Direction sportive"].map((s) => (
            <div key={s}><p className="font-semibold">{s}</p><p className="text-[10px] text-[#667]">Nom, date et signature</p><div className="mt-14 border-t border-dashed" /></div>
          ))}
        </div>
        <DocFooter note="Délégation officielle — Yamoussoukro FC Féminin." />
      </div>
    </>
  );
}
