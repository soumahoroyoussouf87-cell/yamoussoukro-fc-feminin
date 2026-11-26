"use client";

import { useActionState, useState, useTransition } from "react";
import { activateCompetition, activateSeason, createCompetition, createSeason, inviteUser, revokeRole, updateClub } from "@/app/(app)/administration/actions";
import type { FormState } from "@/app/(app)/effectif/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input, Select } from "@/components/ui/form";

function Result({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-success">{state.ok}</p>;
  return null;
}

export function InviteForm({ roles, players }: { roles: { id: string; code: string; label: string }[]; players: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(inviteUser, {});
  const [roleId, setRoleId] = useState("");
  const isPlayer = roles.find((r) => r.id === roleId)?.code === "player";
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom complet" htmlFor="full_name" error={fe.full_name}><Input id="full_name" name="full_name" required /></Field>
      <Field label="E-mail" htmlFor="email" error={fe.email}><Input id="email" name="email" type="email" required /></Field>
      <Field label="Rôle" htmlFor="role_id" error={fe.role_id}>
        <Select id="role_id" name="role_id" required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="" disabled>Choisir…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
      </Field>
      {isPlayer ? (
        <Field label="Fiche joueuse à relier" htmlFor="player_id" error={fe.player_id}>
          <Select id="player_id" name="player_id" required defaultValue="">
            <option value="" disabled>Choisir…</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      ) : <input type="hidden" name="player_id" value="" />}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Inviter / attribuer le rôle"}</Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [err, setErr] = useState<string>();
  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmButton onConfirm={async () => setErr((await revokeRole(id)).error)} label="Révoquer" confirmLabel="Confirmer la révocation" />
      {err ? <span role="alert" className="text-xs text-danger">{err}</span> : null}
    </span>
  );
}

export function ClubForm({ club, minObs }: { club: { name: string; short_name: string | null; city: string | null }; minObs: number }) {
  const [state, action, pending] = useActionState(updateClub, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom du club" htmlFor="name"><Input id="name" name="name" defaultValue={club.name} required /></Field>
      <Field label="Nom court" htmlFor="short_name"><Input id="short_name" name="short_name" defaultValue={club.short_name ?? ""} /></Field>
      <Field label="Ville" htmlFor="city"><Input id="city" name="city" defaultValue={club.city ?? ""} /></Field>
      <Field label="Observations minimales avant publication d'un indice" htmlFor="min_observations_for_index" hint="Seuil utilisé par le Performance Framework (Phase 3).">
        <Input id="min_observations_for_index" name="min_observations_for_index" type="number" min={1} max={50} defaultValue={minObs} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={pending}>Enregistrer</Button><Result state={state} /></div>
    </form>
  );
}

export function SeasonForm() {
  const [state, action, pending] = useActionState(createSeason, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <Field label="Saison" htmlFor="label"><Input id="label" name="label" placeholder="2026-2027" required pattern="\d{4}-\d{4}" /></Field>
      <Field label="Début" htmlFor="s_starts_on"><Input id="s_starts_on" name="starts_on" type="date" required /></Field>
      <Field label="Fin" htmlFor="s_ends_on"><Input id="s_ends_on" name="ends_on" type="date" required /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="activate" value="1" defaultChecked className="accent-[var(--yfc-fuchsia)]" />Définir comme saison active</label>
      <div className="flex items-center gap-3 sm:col-span-3"><Button type="submit" disabled={pending}>Créer la saison</Button><Result state={state} /></div>
    </form>
  );
}

export function CompetitionForm({ seasonId, teams }: { seasonId: string; teams: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createCompetition, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="season_id" value={seasonId} />
      <Field label="Nom" htmlFor="c_name"><Input id="c_name" name="name" required placeholder="Intitulé officiel" /></Field>
      <Field label="Équipe" htmlFor="team_id">
        <Select id="team_id" name="team_id" required>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
      </Field>
      <Field label="Type" htmlFor="type">
        <Select id="type" name="type"><option value="championnat">Championnat</option><option value="coupe">Coupe</option><option value="amical">Amical</option><option value="tournoi">Tournoi</option><option value="autre">Autre</option></Select>
      </Field>
      <Field label="Joueuses convoquées (règlement)" htmlFor="squad_size_limit"><Input id="squad_size_limit" name="squad_size_limit" type="number" min={11} max={40} defaultValue={18} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="activate" value="1" defaultChecked className="accent-[var(--yfc-fuchsia)]" />Définir comme compétition active</label>
      <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={pending}>Créer la compétition</Button><Result state={state} /></div>
    </form>
  );
}

export function ActivateButton({ kind, id }: { kind: "season" | "competition"; id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(() => (kind === "season" ? activateSeason(id) : activateCompetition(id)))}>
      Activer
    </Button>
  );
}
