import Link from "next/link";
import { Printer, Trash2, UserPlus } from "lucide-react";
import { can, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApprovalHistory, listStaffOptions } from "@/lib/phase2/data";
import { DELEGATION_GROUP_LABELS } from "@/lib/phase2/labels";
import { setWorkflowStatus } from "@/lib/phase2/workflow-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoForm } from "@/components/phase2/auto-form";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { ActionButton } from "@/components/phase2/action-button";
import { addDelegationMember, createDelegation, importSquadToDelegation, removeDelegationMember, saveDelegation } from "../../../actions";

export const metadata = { title: "Délégation" };

const local = (ts: string | null) => (ts ? new Date(ts).toISOString().slice(0, 16) : null);

export default async function DelegationPage({ params }: PageProps<"/competition/rencontres/[id]/delegation">) {
  const ctx = await requirePermission("matches.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("delegations")
    .select("*, delegation_members(id, member_group, external_name, function_label, room, players(first_name, last_name), staff_members(first_name, last_name, roles(label)))")
    .eq("match_id", id)
    .maybeSingle();
  const write = can(ctx, "delegations.write");
  const validate = can(ctx, "delegations.validate");
  if (!d) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1">Aucune délégation pour ce match : responsable, transport, horaires, hébergement, restauration, matériel, budget et liste des membres.</span>
        {write ? <ActionButton action={createDelegation.bind(null, id)} variant="default">Créer la délégation</ActionButton> : null}
      </Card>
    );
  }
  const [staff, history] = await Promise.all([listStaffOptions(ctx), getApprovalHistory("delegations", d.id)]);
  const locked = ["valide", "publie", "archive"].includes(d.status) && !validate;
  const editable = write && !locked;
  const members = d.delegation_members ?? [];
  const groups = Object.keys(DELEGATION_GROUP_LABELS).filter((g) => members.some((m) => m.member_group === g));
  const name = (m: (typeof members)[number]) => m.players ? `${m.players.first_name} ${m.players.last_name}` : m.staff_members ? `${m.staff_members.first_name} ${m.staff_members.last_name}` : m.external_name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <WorkflowBar status={d.status} canWrite={write} canValidate={validate} onChange={setWorkflowStatus.bind(null, "delegations", d.id, `/competition/rencontres/${id}/delegation`)}
            validateHint="La délégation est soumise par le Team Manager puis validée par l'entraîneur principal ou la direction sportive. La soumission notifie les valideurs." />
        </div>
        <Button asChild variant="outline"><Link href={`/impression/delegation/${id}`} target="_blank"><Printer />Document officiel (PDF)</Link></Button>
      </div>
      <ApprovalHistory items={history} />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div>
          {editable ? (
            <AutoForm action={saveDelegation.bind(null, d.id, id)} submitLabel="Enregistrer la délégation"
              fields={[
                { name: "head_staff_id", label: "Chef de délégation", type: "select", emptyOption: "—", options: staff, defaultValue: d.head_staff_id },
                { name: "driver", label: "Chauffeur", defaultValue: d.driver },
                { name: "transport", label: "Transport", defaultValue: d.transport, placeholder: "Ex. Car du club" },
                { name: "departure_at", label: "Départ", type: "datetime-local", defaultValue: local(d.departure_at) },
                { name: "return_at", label: "Retour", type: "datetime-local", defaultValue: local(d.return_at) },
                { name: "budget_planned", label: "Budget prévu (FCFA)", type: "number", min: 0, defaultValue: d.budget_planned },
                { name: "budget_actual", label: "Budget réel (FCFA)", type: "number", min: 0, defaultValue: d.budget_actual },
                { name: "accommodation", label: "Hébergement", type: "textarea", span: 2, defaultValue: d.accommodation, maxLength: 1000, rows: 2 },
                { name: "catering", label: "Restauration", type: "textarea", span: 3, defaultValue: d.catering, maxLength: 1000, rows: 2 },
                { name: "schedule", label: "Horaires", type: "textarea", span: 3, defaultValue: d.schedule, maxLength: 3000, rows: 3 },
                { name: "trip_program", label: "Programme du déplacement", type: "textarea", span: 3, defaultValue: d.trip_program, maxLength: 4000, rows: 4 },
                { name: "equipment", label: "Matériel", type: "textarea", span: 3, defaultValue: d.equipment, maxLength: 2000, rows: 2 },
              ]} />
          ) : (
            <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
              {([["Transport", d.transport], ["Chauffeur", d.driver], ["Hébergement", d.accommodation], ["Restauration", d.catering], ["Horaires", d.schedule], ["Programme", d.trip_program], ["Matériel", d.equipment]] as const).map(([k, v]) => (
                <div key={k}><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="whitespace-pre-line text-sm">{v ?? "—"}</p></div>
              ))}
            </CardContent></Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membres ({members.length})</CardTitle>
            <CardDescription>Joueuses, staff technique, performance, médical, administration, communication et logistique.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {editable ? <ActionButton action={importSquadToDelegation.bind(null, d.id, id)}><UserPlus className="size-4" />Importer les joueuses convoquées</ActionButton> : null}
            {groups.map((g) => (
              <section key={g}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary-text">{DELEGATION_GROUP_LABELS[g]} ({members.filter((m) => m.member_group === g).length})</h3>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                  {members.filter((m) => m.member_group === g).map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="flex-1">{name(m)} <span className="text-xs text-muted-foreground">{m.function_label ?? m.staff_members?.roles?.label ?? ""}{m.room ? ` · ch. ${m.room}` : ""}</span></span>
                      {editable ? <ActionButton action={removeDelegationMember.bind(null, id, m.id)} variant="ghost"><Trash2 className="size-4" aria-label="Retirer" /></ActionButton> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {editable ? (
              <details className="rounded-md border border-dashed p-2">
                <summary className="cursor-pointer text-sm font-semibold">Ajouter un membre</summary>
                <div className="mt-2">
                  <AutoForm bare columns={1} action={addDelegationMember.bind(null, d.id, id)} submitLabel="Ajouter"
                    fields={[
                      { name: "member_group", label: "Groupe", type: "select", required: true, options: Object.entries(DELEGATION_GROUP_LABELS).filter(([k]) => k !== "joueuse").map(([value, label]) => ({ value, label })) },
                      { name: "staff_member_id", label: "Membre du staff", type: "select", emptyOption: "—", options: staff },
                      { name: "external_name", label: "… ou personne extérieure", placeholder: "Nom et prénom" },
                      { name: "function_label", label: "Fonction", placeholder: "Ex. Médecin, chauffeur…" },
                      { name: "room", label: "Chambre", maxLength: 20 },
                    ]} />
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
