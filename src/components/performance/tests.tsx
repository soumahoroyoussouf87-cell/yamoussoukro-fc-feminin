"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import {
  createTestSession, saveTestResults, setTestSessionStatus, updateProtocol, updateTestSession, type TestCreateState,
} from "@/lib/performance/test-actions";
import { MEASURE_LABELS, testResultIndex, type Measure } from "@/lib/performance/engine";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
const toNum = (v: string) => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export type ProtocolLite = { id: string; name: string; measure: Measure; attempts: number; ref_best: number | null; ref_limit: number | null; setup: string; version_no: number };

// ----------------------------------------------------------------- Création
export function NewTestForm({ today, protocols, sessions }: { today: string; protocols: ProtocolLite[]; sessions: { id: string; date: string; label: string }[] }) {
  const [state, action, pending] = useActionState<TestCreateState, FormData>(createTestSession, undefined);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState("");
  const [date, setDate] = useState(today);
  const fe = state?.fieldErrors ?? {};
  const n = Object.values(picked).filter(Boolean).length;
  return (
    <form action={action} className="max-w-3xl space-y-4 rounded-xl border bg-card p-5">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Protocoles réalisés</legend>
        <p className="mb-2 text-xs text-muted-foreground">Cochez les tests prévus. Vous pourrez en ajouter ou en retirer ensuite.</p>
        <div className="mb-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setPicked(Object.fromEntries(protocols.map((p) => [p.id, true])))}>Tout cocher</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPicked({})}>Tout décocher</Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {protocols.map((p) => (
            <li key={p.id}>
              <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm focus-within:outline-2 focus-within:outline-ring", picked[p.id] && "border-fuchsia bg-fuchsia/10")}>
                <input type="checkbox" name="protocol_ids" value={p.id} className="mt-0.5 size-4" checked={!!picked[p.id]} onChange={(e) => setPicked((x) => ({ ...x, [p.id]: e.target.checked }))} />
                <span><strong>{p.name}</strong><span className="block text-xs text-muted-foreground">{p.measure === "temps" ? "Chronométré" : `${p.attempts} tentatives`}</span></span>
              </label>
            </li>
          ))}
        </ul>
        {fe.protocol_ids ? <p className="mt-1 text-xs font-medium text-danger">{fe.protocol_ids}</p> : null}
      </fieldset>
      <Field label="Séance d'entraînement (facultatif)" htmlFor="training_session_id" hint="Lier la séance propose les joueuses présentes.">
        <Select id="training_session_id" name="training_session_id" value={sessionId} onChange={(e) => { setSessionId(e.target.value); const s = sessions.find((x) => x.id === e.target.value); if (s) setDate(s.date); }}>
          <option value="">— Sans lien avec une fiche de séance —</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Date" htmlFor="tested_on" error={fe.tested_on}>
          <Input id="tested_on" name="tested_on" type="date" required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Titre" htmlFor="title" error={fe.title}>
          <Input id="title" name="title" required maxLength={160} defaultValue={`Tests techniques ${n ? `(${n} protocole${n > 1 ? "s" : ""})` : ""}`.trim()} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lieu (facultatif)" htmlFor="location" error={fe.location}>
          <Input id="location" name="location" maxLength={160} placeholder="Terrain principal…" />
        </Field>
        <Field label="Conditions de réalisation" htmlFor="conditions" error={fe.conditions} hint="Surface, météo, ballon, heure, état de fatigue…">
          <Textarea id="conditions" name="conditions" rows={2} maxLength={1000} />
        </Field>
      </div>
      {state?.error ? <p role="alert" className="text-sm font-medium text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer la séance de tests"}</Button>
        <Button asChild variant="ghost"><Link href="/performance/tests">Annuler</Link></Button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------- Séance
export function TestWorkflow({ id, status, canWrite, canValidate }: { id: string; status: string; canWrite: boolean; canValidate: boolean }) {
  const router = useRouter();
  return (
    <WorkflowBar status={status} canWrite={canWrite} canValidate={canValidate}
      validateHint="La validation est réservée à l'entraîneur principal et à la direction sportive. Une séance validée est verrouillée et entre dans la note technique (source Tests, 20 %)."
      onChange={async (to) => {
        const r = await setTestSessionStatus(id, to);
        if (!r.error) router.refresh();
        return r;
      }} />
  );
}

export function TestSessionMeta({ id, title, date, location, conditions, notes, editable }: {
  id: string; title: string; date: string; location: string | null; conditions: string | null; notes: string | null; editable: boolean;
}) {
  const save = useAutosave<{ title?: string; tested_on?: string; location?: string | null; conditions?: string | null; notes?: string | null }>(async (patch) => {
    const r = await updateTestSession(id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  if (!editable) {
    return (
      <dl className="space-y-1 text-sm">
        {location ? <div><dt className="inline font-medium">Lieu : </dt><dd className="inline">{location}</dd></div> : null}
        <div><dt className="inline font-medium">Conditions : </dt><dd className="inline">{conditions ?? <span className="text-muted-foreground">non renseignées</span>}</dd></div>
        {notes ? <div><dt className="inline font-medium">Notes : </dt><dd className="inline">{notes}</dd></div> : null}
      </dl>
    );
  }
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">Titre
        <Input defaultValue={title} maxLength={160} onChange={(e) => e.target.value.trim().length >= 2 && save.queue({ title: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-muted-foreground">Date
          <Input type="date" defaultValue={date} onChange={(e) => e.target.value && save.queue({ tested_on: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">Lieu
          <Input defaultValue={location ?? ""} maxLength={160} onChange={(e) => save.queue({ location: e.target.value })} />
        </label>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">Conditions de réalisation
        <Textarea rows={2} defaultValue={conditions ?? ""} maxLength={1000} placeholder="Surface, météo, ballon, heure…" onChange={(e) => save.queue({ conditions: e.target.value })} />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">Notes
        <Textarea rows={2} defaultValue={notes ?? ""} maxLength={2000} onChange={(e) => save.queue({ notes: e.target.value })} />
      </label>
      <SaveIndicator state={save.state} />
    </div>
  );
}

type PlayerLite = { id: string; name: string; shirt: number | null; suggested: boolean };

/** Choix des protocoles et des joueuses testées. */
export function TestSetup({ id, protocols, selectedProtocols, players, selectedPlayers, source }: {
  id: string; protocols: ProtocolLite[]; selectedProtocols: string[]; players: PlayerLite[]; selectedPlayers: string[]; source: string;
}) {
  const router = useRouter();
  const [prot, setProt] = useState(() => new Set(selectedProtocols));
  const [pl, setPl] = useState(() => new Set(selectedPlayers));
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const list = showAll ? players : players.filter((p) => p.suggested || pl.has(p.id));
  const dirty = [...prot].sort().join() !== [...selectedProtocols].sort().join() || [...pl].sort().join() !== [...selectedPlayers].sort().join();
  const toggle = (set: Set<string>, v: string, on: boolean) => { const n = new Set(set); if (on) n.add(v); else n.delete(v); return n; };

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="setup-title">
      <h2 id="setup-title" className="mb-3 font-display text-lg font-bold uppercase">Protocoles et joueuses</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Protocoles ({prot.size})</legend>
          <ul className="grid gap-1.5">
            {protocols.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={prot.has(p.id)} onChange={(e) => setProt((s) => toggle(s, p.id, e.target.checked))} />
                  {p.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Joueuses ({pl.size})</legend>
          <p className="mb-2 text-xs text-muted-foreground">{showAll ? "Effectif complet" : source}</p>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPl(new Set([...pl, ...list.map((p) => p.id)]))}>Tout cocher</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPl(new Set())}>Tout décocher</Button>
            {players.some((p) => !p.suggested) ? <Button type="button" size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>{showAll ? "Seulement la sélection proposée" : "Afficher tout l'effectif"}</Button> : null}
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={pl.has(p.id)} onChange={(e) => setPl((s) => toggle(s, p.id, e.target.checked))} />
                  <span className="truncate">{p.shirt ? `${p.shirt}. ` : ""}{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!dirty || pending || prot.size === 0} onClick={() => start(async () => {
          setMsg(null);
          const r = await updateTestSession(id, { protocol_ids: [...prot], player_ids: [...pl] });
          if (r.error) setMsg(r.error);
          else router.refresh();
        })}>{pending ? "Enregistrement…" : "Mettre à jour la grille"}</Button>
        {prot.size === 0 ? <span className="text-xs text-warning">Gardez au moins un protocole.</span> : null}
        {msg ? <span role="alert" className="text-sm text-danger">{msg}</span> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Retirer une joueuse ou un protocole masque sa colonne ; les résultats déjà saisis sont conservés.</p>
    </section>
  );
}

type Cell = { attempts: number | null; successes: number | null; errors: number | null; valueSeconds: number | null; notes: string | null };
const EMPTY: Cell = { attempts: null, successes: null, errors: null, valueSeconds: null, notes: null };

/** Grille de saisie : un protocole à la fois, une ligne par joueuse, enregistrement automatique. */
export function TestSheet({ sessionId, protocols, players, initial, editable }: {
  sessionId: string; protocols: ProtocolLite[]; players: { id: string; name: string; shirt: number | null }[];
  initial: Record<string, Cell>; editable: boolean;
}) {
  const [active, setActive] = useState(protocols[0]?.id ?? "");
  const [cells, setCells] = useState<Record<string, Cell>>(initial);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, string>>({});
  const save = useAutosave<Record<string, Cell>>(async (patch) => {
    const r = await saveTestResults(sessionId, Object.entries(patch).map(([k, c]) => {
      const [protocolId, playerId] = k.split("|");
      return { protocolId, playerId, ...c };
    }));
    return r.error ? { ok: false, error: r.error } : { ok: true };
  }, { delay: 700 });
  const p = protocols.find((x) => x.id === active) ?? protocols[0];
  const done = useMemo(() => Object.fromEntries(protocols.map((pr) => [pr.id, players.filter((pl) => {
    const c = cells[`${pr.id}|${pl.id}`];
    return c && (pr.measure === "temps" ? c.valueSeconds != null : c.successes != null);
  }).length])), [cells, protocols, players]);
  if (!p) return null;

  const set = (playerId: string, field: keyof Cell, text: string) => {
    const k = `${p.id}|${playerId}`;
    const fk = `${k}|${field}`;
    setRaw((r) => ({ ...r, [fk]: text }));
    let value: number | string | null;
    if (field === "notes") value = text.trim() === "" ? null : text;
    else {
      const n = toNum(text);
      const intField = field !== "valueSeconds";
      if (Number.isNaN(n) || (n != null && intField && !Number.isInteger(n)) || (n != null && n < 0)) {
        setBad((b) => ({ ...b, [fk]: "Nombre invalide" }));
        return;
      }
      value = n;
    }
    setBad((b) => { const c = { ...b }; delete c[fk]; return c; });
    const prev = cells[k] ?? EMPTY;
    const next: Cell = { ...prev, [field]: value };
    // Tentatives prévues par le protocole, si non saisies.
    if (field === "successes" && next.attempts == null && value != null) next.attempts = p.attempts;
    if (next.successes != null && next.attempts != null && next.successes > next.attempts) {
      setBad((b) => ({ ...b, [fk]: "Plus que les tentatives" }));
      return;
    }
    setCells((c) => ({ ...c, [k]: next }));
    save.queue({ [k]: next });
  };
  const val = (playerId: string, field: keyof Cell) => {
    const fk = `${p.id}|${playerId}|${field}`;
    if (raw[fk] !== undefined) return raw[fk];
    const v = cells[`${p.id}|${playerId}`]?.[field];
    return v == null ? "" : String(v).replace(".", ",");
  };
  const num = "h-9 w-20 text-center tabular-nums";

  return (
    <section aria-labelledby="sheet-title" className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <h2 id="sheet-title" className="font-display text-lg font-bold uppercase">Saisie des résultats</h2>
        <SaveIndicator state={save.state} />
      </div>
      <div role="tablist" aria-label="Protocoles" className="flex gap-1 overflow-x-auto border-b px-2 py-2">
        {protocols.map((pr) => (
          <button key={pr.id} type="button" role="tab" aria-selected={pr.id === p.id} onClick={() => setActive(pr.id)}
            className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm", pr.id === p.id ? "bg-fuchsia/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted")}>
            {pr.name} <span className="text-xs tabular-nums">{done[pr.id]}/{players.length}</span>
          </button>
        ))}
      </div>
      <div className="p-4">
        <p className="mb-1 text-sm"><strong>{p.name}</strong> · protocole v{p.version_no} · {MEASURE_LABELS[p.measure]}</p>
        <p className="mb-3 text-xs text-muted-foreground">{p.setup}</p>
        {p.measure === "temps" && p.ref_best == null ? (
          <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">Barème à définir dans « Protocoles » : les temps sont enregistrés et comparés, mais n&apos;entrent pas encore dans la note technique.</p>
        ) : null}
        {players.length === 0 ? <p className="text-sm text-muted-foreground">Ajoutez des joueuses dans le panneau « Protocoles et joueuses ».</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-2 font-medium">Joueuse</th>
                  {p.measure === "reussite" ? (
                    <><th scope="col" className="px-1 font-medium">Tentatives</th><th scope="col" className="px-1 font-medium">Réussites</th></>
                  ) : (
                    <><th scope="col" className="px-1 font-medium">Essais</th><th scope="col" className="px-1 font-medium">Temps (s)</th></>
                  )}
                  <th scope="col" className="px-1 font-medium">Erreurs</th>
                  <th scope="col" className="px-1 text-center font-medium">Indice</th>
                  <th scope="col" className="px-1 font-medium">Observation</th>
                </tr>
              </thead>
              <tbody>
                {players.map((pl) => {
                  const c = cells[`${p.id}|${pl.id}`] ?? EMPTY;
                  const idx = testResultIndex({ measure: p.measure, attempts: c.attempts, successes: c.successes, valueSeconds: c.valueSeconds, refBest: p.ref_best, refLimit: p.ref_limit });
                  const errs = (["attempts", "successes", "valueSeconds", "errors"] as const).map((f) => bad[`${p.id}|${pl.id}|${f}`]).filter(Boolean);
                  const label = `${pl.name}, ${p.name}`;
                  return (
                    <tr key={pl.id} className="border-b last:border-0">
                      <th scope="row" className="whitespace-nowrap py-1.5 pr-2 text-left font-medium">{pl.shirt ? `${pl.shirt}. ` : ""}{pl.name}
                        {errs.length ? <span role="alert" className="block text-xs font-normal text-danger">{errs[0]}</span> : null}
                      </th>
                      <td className="px-1"><Input inputMode="numeric" aria-label={`${label} : ${p.measure === "temps" ? "essais" : "tentatives"}`} className={num} placeholder={String(p.attempts)} disabled={!editable} value={val(pl.id, "attempts")} onChange={(e) => set(pl.id, "attempts", e.target.value)} /></td>
                      <td className="px-1">
                        {p.measure === "reussite"
                          ? <Input inputMode="numeric" aria-label={`${label} : réussites`} className={num} disabled={!editable} value={val(pl.id, "successes")} onChange={(e) => set(pl.id, "successes", e.target.value)} />
                          : <Input inputMode="decimal" aria-label={`${label} : temps en secondes`} className={num} disabled={!editable} value={val(pl.id, "valueSeconds")} onChange={(e) => set(pl.id, "valueSeconds", e.target.value)} />}
                      </td>
                      <td className="px-1"><Input inputMode="numeric" aria-label={`${label} : erreurs`} className={num} disabled={!editable} value={val(pl.id, "errors")} onChange={(e) => set(pl.id, "errors", e.target.value)} /></td>
                      <td className="px-1 text-center tabular-nums">{idx == null ? <span className="text-muted-foreground">—</span> : fmt(idx)}</td>
                      <td className="px-1"><Input aria-label={`${label} : observation`} className="h-9 min-w-40" maxLength={500} disabled={!editable} value={val(pl.id, "notes")} onChange={(e) => set(pl.id, "notes", e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {p.measure === "reussite" ? "Indice = réussites ÷ tentatives × 100." : "Indice = position du temps entre le temps de référence (100) et le temps limite (0)."} Les tentatives prévues ({p.attempts}) sont reprises si la case est vide.
        </p>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- Protocoles
export function ProtocolCard({ p, criteria, editable, used }: {
  p: ProtocolLite & { objective: string | null; criterion_codes: string[]; active: boolean; code: string };
  criteria: { code: string; label: string }[]; editable: boolean; used: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: p.name, objective: p.objective ?? "", setup: p.setup, attempts: String(p.attempts), ref_best: p.ref_best == null ? "" : String(p.ref_best).replace(".", ","), ref_limit: p.ref_limit == null ? "" : String(p.ref_limit).replace(".", ","), codes: new Set(p.criterion_codes) });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const labels = new Map(criteria.map((c) => [c.code, c.label]));
  const changesVersion = form.setup !== p.setup || Number(form.attempts) !== p.attempts || toNum(form.ref_best) !== p.ref_best || toNum(form.ref_limit) !== p.ref_limit
    || [...form.codes].sort().join() !== [...p.criterion_codes].sort().join();

  return (
    <li className={cn("rounded-xl border bg-card p-4", !p.active && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{p.name} <span className="text-xs font-normal text-muted-foreground">· v{p.version_no}{p.active ? "" : " · désactivé"}</span></h3>
          {p.objective ? <p className="text-xs text-muted-foreground">{p.objective}</p> : null}
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{p.measure === "temps" ? "Chronométré" : `${p.attempts} tentatives`}</span>
      </div>
      <p className="mt-2 text-sm">{p.setup}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Alimente : {p.criterion_codes.map((c) => labels.get(c) ?? c).join(", ") || "aucun critère"}
        {p.measure === "temps" ? ` · Barème : ${p.ref_best == null ? "à définir" : `${fmt(p.ref_best)} s = 100, ${fmt(p.ref_limit)} s = 0`}` : ""}
        {used ? ` · ${used} résultat${used > 1 ? "s" : ""} enregistré${used > 1 ? "s" : ""}` : ""}
      </p>
      {editable ? (
        <div className="mt-3">
          {!open ? <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Modifier</Button> : (
            <div className="space-y-3 border-t pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom" htmlFor={`n-${p.id}`}><Input id={`n-${p.id}`} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Objectif" htmlFor={`o-${p.id}`}><Input id={`o-${p.id}`} value={form.objective} maxLength={500} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></Field>
              </div>
              <Field label="Conditions de réalisation" htmlFor={`s-${p.id}`} hint="Distance, cible, matériel, consignes, critère de réussite.">
                <Textarea id={`s-${p.id}`} rows={3} value={form.setup} maxLength={2000} onChange={(e) => setForm({ ...form, setup: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={p.measure === "temps" ? "Essais prévus" : "Tentatives prévues"} htmlFor={`a-${p.id}`}><Input id={`a-${p.id}`} inputMode="numeric" value={form.attempts} onChange={(e) => setForm({ ...form, attempts: e.target.value })} /></Field>
                {p.measure === "temps" ? (
                  <>
                    <Field label="Temps de référence (= 100)" htmlFor={`b-${p.id}`} hint="En secondes"><Input id={`b-${p.id}`} inputMode="decimal" value={form.ref_best} onChange={(e) => setForm({ ...form, ref_best: e.target.value })} /></Field>
                    <Field label="Temps limite (= 0)" htmlFor={`l-${p.id}`} hint="En secondes"><Input id={`l-${p.id}`} inputMode="decimal" value={form.ref_limit} onChange={(e) => setForm({ ...form, ref_limit: e.target.value })} /></Field>
                  </>
                ) : null}
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Critères techniques alimentés</legend>
                <div className="flex flex-wrap gap-1.5">
                  {criteria.map((c) => (
                    <label key={c.code} className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs focus-within:outline-2 focus-within:outline-ring", form.codes.has(c.code) && "border-fuchsia bg-fuchsia/10 font-semibold")}>
                      <input type="checkbox" className="sr-only" checked={form.codes.has(c.code)} onChange={(e) => { const s = new Set(form.codes); if (e.target.checked) s.add(c.code); else s.delete(c.code); setForm({ ...form, codes: s }); }} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {changesVersion ? <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">Ces changements créent la version {p.version_no + 1} du protocole. Les résultats déjà validés gardent la version {p.version_no} et ne sont comparés qu&apos;entre eux.</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
                  setMsg(null);
                  const attempts = toNum(form.attempts);
                  const best = toNum(form.ref_best);
                  const limit = toNum(form.ref_limit);
                  if (attempts == null || Number.isNaN(attempts) || Number.isNaN(best) || Number.isNaN(limit)) { setMsg("Valeurs numériques invalides."); return; }
                  const r = await updateProtocol(p.id, {
                    name: form.name, objective: form.objective, setup: form.setup, attempts,
                    ...(p.measure === "temps" ? { ref_best: best, ref_limit: limit } : {}),
                    criterion_codes: [...form.codes],
                  });
                  if (r.error) setMsg(r.error);
                  else { setOpen(false); router.refresh(); }
                })}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <span className="flex-1" />
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
                  const r = await updateProtocol(p.id, { active: !p.active });
                  if (r.error) setMsg(r.error); else router.refresh();
                })}>{p.active ? "Désactiver" : "Réactiver"}</Button>
              </div>
              {msg ? <p role="alert" className="text-sm text-danger">{msg}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
