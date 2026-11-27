"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageSquareText, Trash2 } from "lucide-react";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import {
  createCollectiveEvaluation, saveCollectiveScores, saveMeasure, setCollectiveStatus, updateCollectiveEvaluation, type CollCreateState,
} from "@/lib/performance/game-actions";
import {
  evaluateCollective, inTarget, LINE_RELATIONS, RELATION_CRITERIA, RELATION_LABELS, RELATIONS, SECTOR_CRITERIA, SECTORS, SITUATION_LABELS, SITUATIONS,
  type CollectiveScore, type GameVersionModel,
} from "@/lib/performance/collective";
import { levelOf, SCALE } from "@/lib/performance/engine";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) => (n == null ? "—" : String(n).replace(".", ","));
type Opt = { id: string; date: string; label: string };

// ----------------------------------------------------------------- Création
export function NewCollectiveForm({ today, versionLabel, matches, sessions, systems, initialMatch, initialSession }: {
  today: string; versionLabel: string; matches: Opt[]; sessions: Opt[]; systems: { id: string; name: string; isReference: boolean }[]; initialMatch?: string; initialSession?: string;
}) {
  const [state, action, pending] = useActionState<CollCreateState, FormData>(createCollectiveEvaluation, undefined);
  const [context, setContext] = useState<"match" | "entrainement">(initialSession ? "entrainement" : "match");
  const [matchId, setMatchId] = useState(initialMatch ?? "");
  const [sessionId, setSessionId] = useState(initialSession ?? "");
  const linked = context === "match" ? matches.find((m) => m.id === matchId) : sessions.find((s) => s.id === sessionId);
  const [date, setDate] = useState(linked?.date ?? today);
  const [title, setTitle] = useState("");
  const autoTitle = linked ? `Collectif ${linked.label.split(" · ").slice(1).join(" · ")}` : context === "match" ? "Évaluation collective de match" : "Évaluation collective d'entraînement";
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-xl border bg-card p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Contexte</legend>
        <div className="flex gap-2">
          {(["match", "entrainement"] as const).map((c) => (
            <label key={c} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm focus-within:outline-2 focus-within:outline-ring", context === c && "border-fuchsia bg-fuchsia/10 font-semibold")}>
              <input type="radio" name="context" value={c} checked={context === c} onChange={() => setContext(c)} className="sr-only" />
              {c === "match" ? "Compétition" : "Entraînement"}
            </label>
          ))}
        </div>
      </fieldset>
      {context === "match" ? (
        <Field label="Match" htmlFor="match_id">
          <Select id="match_id" name="match_id" value={matchId} onChange={(e) => { setMatchId(e.target.value); const m = matches.find((x) => x.id === e.target.value); if (m) setDate(m.date); }}>
            <option value="">— Sans lien avec un match enregistré —</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </Field>
      ) : (
        <Field label="Séance d'entraînement" htmlFor="training_session_id">
          <Select id="training_session_id" name="training_session_id" value={sessionId} onChange={(e) => { setSessionId(e.target.value); const s = sessions.find((x) => x.id === e.target.value); if (s) setDate(s.date); }}>
            <option value="">— Sans lien avec une fiche de séance —</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Date" htmlFor="evaluated_on" error={fe.evaluated_on}>
          <Input id="evaluated_on" name="evaluated_on" type="date" required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Titre" htmlFor="title" error={fe.title}>
          <Input id="title" name="title" required maxLength={160} value={title || autoTitle} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <Field label="Système utilisé (facultatif)" htmlFor="system_id">
        <Select id="system_id" name="system_id" defaultValue={systems.find((s) => s.isReference)?.id ?? ""}>
          <option value="">— Non précisé —</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Notes (facultatif)" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={2000} rows={2} placeholder="Adversaire, conditions, plan de jeu…" />
      </Field>
      <p className="text-xs text-muted-foreground">Projet de jeu utilisé : <strong>{versionLabel}</strong>. Il reste attaché à cette évaluation même si une nouvelle version est publiée.</p>
      {state?.error ? <p role="alert" className="text-sm font-medium text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer l'évaluation collective"}</Button>
        <Button asChild variant="ghost"><Link href="/performance/collective">Annuler</Link></Button>
      </div>
    </form>
  );
}

export function CollectiveWorkflow({ id, status, canWrite, canValidate }: { id: string; status: string; canWrite: boolean; canValidate: boolean }) {
  const router = useRouter();
  return (
    <WorkflowBar status={status} canWrite={canWrite} canValidate={canValidate}
      validateHint="La validation est réservée à l'entraîneur principal et à la direction sportive. Une évaluation validée est verrouillée et entre dans l'IPC, l'IMP, l'IPS et l'IPR."
      onChange={async (to) => { const r = await setCollectiveStatus(id, to); if (!r.error) router.refresh(); return r; }} />
  );
}

export function CollectiveMeta({ id, title, date, notes, systemId, systems, editable }: {
  id: string; title: string; date: string; notes: string | null; systemId: string | null; systems: { id: string; name: string }[]; editable: boolean;
}) {
  const save = useAutosave<{ title?: string; evaluated_on?: string; notes?: string | null; system_id?: string | null }>(async (patch) => {
    const r = await updateCollectiveEvaluation(id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  if (!editable) return notes ? <p className="text-sm text-muted-foreground">{notes}</p> : null;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">Titre
        <Input defaultValue={title} maxLength={160} onChange={(e) => e.target.value.trim().length >= 2 && save.queue({ title: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-muted-foreground">Date
          <Input type="date" defaultValue={date} onChange={(e) => e.target.value && save.queue({ evaluated_on: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">Système
          <Select defaultValue={systemId ?? ""} onChange={(e) => save.queue({ system_id: e.target.value || null }, true)}>
            <option value="">— Non précisé —</option>
            {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">Notes
        <Textarea rows={2} defaultValue={notes ?? ""} maxLength={2000} onChange={(e) => save.queue({ notes: e.target.value })} />
      </label>
      <SaveIndicator state={save.state} />
    </div>
  );
}

// ----------------------------------------------------------------- Saisie
type Row = { score: number | null; fact: string | null; interpretation: string | null };
const k = (kind: string, unit: string, criterion: string) => `${kind}|${unit}|${criterion}`;

function ScoreLine({ id, label, hint, row, editable, onSet }: { id: string; label: string; hint?: string | null; row: Row | undefined; editable: boolean; onSet: (p: Partial<Row>) => void }) {
  const [open, setOpen] = useState(!!(row?.fact || row?.interpretation));
  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">{label}{hint ? <span className="block text-xs font-normal text-muted-foreground">{hint}</span> : null}</span>
        <div role="group" aria-label={`Note : ${label}`} className="flex gap-1">
          {SCALE.map((s) => (
            <button key={s.score} type="button" disabled={!editable} aria-pressed={row?.score === s.score} title={`${s.score} · ${s.label}`}
              onClick={() => onSet({ score: row?.score === s.score ? null : s.score })}
              className={cn("size-9 rounded-md border text-sm font-bold tabular-nums transition-colors disabled:cursor-not-allowed", row?.score === s.score ? "border-fuchsia bg-fuchsia text-white" : "hover:bg-muted")}>
              {s.score}
            </button>
          ))}
          <button type="button" disabled={!editable} aria-pressed={!!row && row.score == null} title="Non évalué : ne pénalise pas" onClick={() => onSet({ score: null })}
            className={cn("h-9 rounded-md border px-2 text-xs font-semibold", row && row.score == null ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted")}>N/E</button>
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Fait observé et interprétation"
            className={cn("flex h-9 items-center gap-1 rounded-md border px-2 text-xs", (row?.fact || row?.interpretation) && "border-primary-text text-primary-text")}>
            <MessageSquareText className="size-4" aria-hidden /><span className="sr-only">Observation pour {label}</span>
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>
      {open ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2" id={id}>
          <label className="text-xs font-medium">Fait observé
            <Textarea rows={2} maxLength={1000} disabled={!editable} value={row?.fact ?? ""} placeholder="Ce qui s'est passé, objectivement (minute, zone, situation)" onChange={(e) => onSet({ fact: e.target.value || null })} />
          </label>
          <label className="text-xs font-medium">Interprétation de l&apos;évaluateur
            <Textarea rows={2} maxLength={1000} disabled={!editable} value={row?.interpretation ?? ""} placeholder="Votre lecture" onChange={(e) => onSet({ interpretation: e.target.value || null })} />
          </label>
        </div>
      ) : null}
    </li>
  );
}

type Measure = { relation_code: string; situation: string; distance_m: number; target_min: number | null; target_max: number | null; note: string | null };

export function CollectiveSheet({ evaluationId, version, initialScores, initialMeasures, targets, editable }: {
  evaluationId: string;
  version: Omit<GameVersionModel, "principles"> & { principles: (GameVersionModel["principles"][number] & { expected_behaviors?: string | null })[] };
  initialScores: { unit_kind: string; unit_code: string; criterion_code: string; score: number | null; fact: string | null; interpretation: string | null }[];
  initialMeasures: Measure[];
  targets: { situation: string; relation_code: string; min_m: number; max_m: number }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"principes" | "secteurs" | "relations">("principes");
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(initialScores.map((s) => [k(s.unit_kind, s.unit_code, s.criterion_code), { score: s.score, fact: s.fact, interpretation: s.interpretation }])));
  const [measures, setMeasures] = useState<Measure[]>(initialMeasures);
  const [m, setM] = useState({ relation: "defense_milieu", situation: "bloc_median", distance: "" });
  const [mErr, setMErr] = useState<string | null>(null);
  const save = useAutosave<Record<string, Row>>(async (patch) => {
    const r = await saveCollectiveScores(evaluationId, Object.entries(patch).map(([key, row]) => {
      const [kind, unit, criterion] = key.split("|");
      return { kind: kind as CollectiveScore["kind"], unit, criterion, ...row };
    }));
    return r.error ? { ok: false, error: r.error } : { ok: true };
  }, { delay: 500 });
  const set = (key: string, patch: Partial<Row>) => {
    if (!editable) return;
    const next = { ...(rows[key] ?? { score: null, fact: null, interpretation: null }), ...patch };
    setRows((r) => ({ ...r, [key]: next }));
    save.queue({ [key]: next });
  };
  const scores: CollectiveScore[] = useMemo(() => Object.entries(rows).map(([key, r]) => {
    const [kind, unit, criterion] = key.split("|");
    return { kind: kind as CollectiveScore["kind"], unit, criterion, score: r.score };
  }), [rows]);
  const live = useMemo(() => evaluateCollective(version, {
    scores, measures: measures.map((x) => ({ relation: x.relation_code, situation: x.situation, distance: x.distance_m, targetMin: x.target_min, targetMax: x.target_max })),
  }), [version, scores, measures]);
  const target = (situation: string, relation: string) => targets.find((t) => t.situation === situation && t.relation_code === relation);

  const addMeasure = async () => {
    const d = Number(m.distance.replace(",", "."));
    if (!Number.isFinite(d) || d <= 0 || d >= 100) { setMErr("Distance en mètres (1 à 99)."); return; }
    const r = await saveMeasure(evaluationId, m.relation, m.situation, d);
    if (r.error) { setMErr(r.error); return; }
    setMErr(null);
    const t = target(m.situation, m.relation);
    setMeasures((list) => [...list.filter((x) => !(x.relation_code === m.relation && x.situation === m.situation)),
      { relation_code: m.relation, situation: m.situation, distance_m: d, target_min: t?.min_m ?? null, target_max: t?.max_m ?? null, note: null }]);
    setM((x) => ({ ...x, distance: "" }));
    router.refresh();
  };
  const removeMeasure = async (x: Measure) => {
    const r = await saveMeasure(evaluationId, x.relation_code, x.situation, null);
    if (r.error) { setMErr(r.error); return; }
    setMeasures((list) => list.filter((y) => y !== x));
  };

  const tabs = [
    { code: "principes", label: "Projet de jeu", count: Object.values(live.moments).reduce((a, x) => a + x.evaluated, 0), total: version.principles.length },
    { code: "secteurs", label: "Secteurs", count: Object.values(live.sectors).reduce((a, x) => a + x.evaluated, 0), total: SECTORS.length * SECTOR_CRITERIA.length },
    { code: "relations", label: "Relations et compacité", count: Object.values(live.relations).reduce((a, x) => a + x.evaluated, 0), total: RELATIONS.length * RELATION_CRITERIA.length },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div role="tablist" aria-label="Volets de l'évaluation" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.code} type="button" role="tab" aria-selected={tab === t.code} onClick={() => setTab(t.code)}
              className={cn("rounded-full border px-3 py-1.5 text-sm", tab === t.code ? "border-fuchsia bg-fuchsia/15 font-semibold" : "text-muted-foreground hover:bg-muted")}>
              {t.label} <span className="text-xs tabular-nums">{t.count}/{t.total}</span>
            </button>
          ))}
        </div>

        {tab === "principes" ? version.moments.map((mo) => {
          const list = version.principles.filter((p) => p.moment === mo.code);
          const x = live.moments[mo.code];
          return (
            <section key={mo.code} className="rounded-xl border bg-card" aria-labelledby={`h-${mo.code}`}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
                <h2 id={`h-${mo.code}`} className="font-display text-xl font-bold uppercase">{mo.label} <span className="text-sm font-normal normal-case text-muted-foreground">({mo.weight} %)</span></h2>
                <span className="text-sm tabular-nums">{x.index == null ? <span className="text-muted-foreground">Non évalué</span> : <><strong>{fmt(x.index)}</strong> · {levelOf(x.index)}</>}</span>
              </header>
              <ul className="divide-y">
                {list.map((p) => <ScoreLine key={p.id} id={`o-${p.code}`} label={p.label} hint={p.expected_behaviors} row={rows[k("principe", p.code, "maitrise")]} editable={editable} onSet={(patch) => set(k("principe", p.code, "maitrise"), patch)} />)}
              </ul>
            </section>
          );
        }) : null}

        {tab === "secteurs" ? SECTORS.map((s) => (
          <section key={s.code} className="rounded-xl border bg-card" aria-labelledby={`h-${s.code}`}>
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
              <h2 id={`h-${s.code}`} className="font-display text-xl font-bold uppercase">{s.label}</h2>
              <span className="text-sm tabular-nums">{live.sectors[s.code].index == null ? <span className="text-muted-foreground">Non évalué</span> : <strong>{fmt(live.sectors[s.code].index)}</strong>}</span>
            </header>
            <ul className="divide-y">
              {SECTOR_CRITERIA.map((c) => <ScoreLine key={c.code} id={`o-${s.code}-${c.code}`} label={c.label} row={rows[k("secteur", s.code, c.code)]} editable={editable} onSet={(patch) => set(k("secteur", s.code, c.code), patch)} />)}
            </ul>
          </section>
        )) : null}

        {tab === "relations" ? (
          <>
            <section className="rounded-xl border bg-card p-4" aria-labelledby="h-compacite">
              <h2 id="h-compacite" className="font-display text-xl font-bold uppercase">Compacité : distances entre les lignes</h2>
              <p className="mb-3 text-xs text-muted-foreground">Distance mesurée (vidéo, GPS ou observation) dans une situation donnée. Elle est comparée à l&apos;objectif de cette situation s&apos;il existe ; sinon elle est seulement enregistrée.</p>
              {measures.length ? (
                <ul className="mb-3 divide-y text-sm">
                  {measures.map((x) => {
                    const ok = inTarget({ relation: x.relation_code, situation: x.situation, distance: x.distance_m, targetMin: x.target_min, targetMax: x.target_max });
                    return (
                      <li key={`${x.relation_code}-${x.situation}`} className="flex flex-wrap items-center gap-2 py-1.5">
                        <span className="flex-1">{RELATION_LABELS[x.relation_code]} · {SITUATION_LABELS[x.situation]}</span>
                        <strong className="tabular-nums">{fmt(x.distance_m)} m</strong>
                        <span className={cn("text-xs", ok === true ? "text-success" : ok === false ? "text-danger" : "text-muted-foreground")}>
                          {ok == null ? "sans objectif" : `${ok ? "dans" : "hors de"} l'objectif ${fmt(x.target_min)}-${fmt(x.target_max)} m`}
                        </span>
                        {editable ? <button type="button" aria-label="Supprimer la mesure" className="text-muted-foreground hover:text-danger" onClick={() => removeMeasure(x)}><Trash2 className="size-4" /></button> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mb-3 text-sm text-muted-foreground">Aucune distance mesurée.</p>}
              {editable ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Lignes
                    <Select value={m.relation} onChange={(e) => setM({ ...m, relation: e.target.value })} className="h-9">
                      {LINE_RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
                    </Select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">Situation
                    <Select value={m.situation} onChange={(e) => setM({ ...m, situation: e.target.value })} className="h-9">
                      {SITUATIONS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                    </Select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">Distance (m)
                    <Input inputMode="decimal" value={m.distance} onChange={(e) => setM({ ...m, distance: e.target.value })} className="h-9 w-24" />
                  </label>
                  <Button type="button" size="sm" variant="outline" onClick={addMeasure} disabled={!m.distance}>Enregistrer la distance</Button>
                  <span className="w-full text-xs text-muted-foreground">
                    {target(m.situation, m.relation) ? `Objectif : ${fmt(target(m.situation, m.relation)!.min_m)}-${fmt(target(m.situation, m.relation)!.max_m)} m` : "Pas d'objectif pour cette situation."}
                  </span>
                  {mErr ? <p role="alert" className="w-full text-xs text-danger">{mErr}</p> : null}
                </div>
              ) : null}
            </section>
            {RELATIONS.map((r) => (
              <section key={r.code} className="rounded-xl border bg-card" aria-labelledby={`h-${r.code}`}>
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
                  <h2 id={`h-${r.code}`} className="font-display text-lg font-bold uppercase">{r.label}</h2>
                  <span className="text-sm tabular-nums">{live.relations[r.code].index == null ? <span className="text-muted-foreground">Non évalué</span> : <strong>{fmt(live.relations[r.code].index)}</strong>}</span>
                </header>
                <ul className="divide-y">
                  {RELATION_CRITERIA.map((c) => <ScoreLine key={c.code} id={`o-${r.code}-${c.code}`} label={c.label} row={rows[k("relation", r.code, c.code)]} editable={editable} onSet={(patch) => set(k("relation", r.code, c.code), patch)} />)}
                </ul>
              </section>
            ))}
          </>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold uppercase">Synthèse</h2>
            <SaveIndicator state={save.state} />
          </div>
          <dl className="divide-y text-sm">
            {version.moments.map((mo) => (
              <div key={mo.code} className="flex items-center justify-between py-1.5">
                <dt>{mo.label} <span className="text-xs text-muted-foreground">({mo.weight} %)</span></dt>
                <dd className="tabular-nums">{live.moments[mo.code].index == null ? <span className="text-muted-foreground">N/E</span> : fmt(live.moments[mo.code].index)}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["IPC", live.ipc], ["IPS", live.ips], ["IPR", live.ipr]] as const).map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted/40 p-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
                <p className="font-display text-2xl font-bold tabular-nums">{fmt(v)}</p>
              </div>
            ))}
          </div>
          {live.compactness.checked ? <p className="text-xs">Compacité : {live.compactness.inTarget}/{live.compactness.checked} mesure(s) dans l&apos;objectif.</p> : null}
          <p className="text-[11px] text-muted-foreground">IPC : moyenne des principes notés par moment, pondérée par moment. Indépendant des notes individuelles. N/E exclu du calcul.</p>
        </div>
      </aside>
    </div>
  );
}
