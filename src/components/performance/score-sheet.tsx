"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import { Select, Textarea } from "@/components/ui/form";
import { saveScores, updateIndividual } from "@/lib/performance/actions";
import {
  applicableCriteria, CONTEXT_LABELS, DIMENSIONS, evaluationDimensions, FRAMEWORK_KEYS, FRAMEWORK_KEY_LABELS, levelOf, SCALE,
  weightedIndex, type Context, type DimensionCode, type FrameworkKey,
} from "@/lib/performance/engine";
import type { VersionFull } from "@/lib/performance/data";
import { cn } from "@/lib/utils";

type Row = { score: number | null; fact: string | null; interpretation: string | null };
type Props = {
  evaluation: { id: string; frameworkKey: FrameworkKey; minutes: number | null; comment: string | null; scores: ({ criterionId: string } & Row)[] };
  version: VersionFull;
  editable: boolean;
  context: Context;
};

const fmt = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

export function ScoreSheet({ evaluation, version, editable, context }: Props) {
  const router = useRouter();
  const [fk, setFk] = useState<FrameworkKey>(evaluation.frameworkKey);
  const [minutes, setMinutes] = useState<string>(evaluation.minutes == null ? "" : String(evaluation.minutes));
  const [comment, setComment] = useState(evaluation.comment ?? "");
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(evaluation.scores.map((s) => [s.criterionId, { score: s.score, fact: s.fact, interpretation: s.interpretation }])));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(evaluation.scores.filter((s) => s.fact || s.interpretation).map((s) => [s.criterionId, true])));

  const scoreSave = useAutosave<Record<string, Row>>(async (patch) => {
    const r = await saveScores(evaluation.id, Object.entries(patch).map(([criterionId, row]) => ({ criterionId, ...row })));
    return r.error ? { ok: false, error: r.error } : { ok: true };
  }, { delay: 500 });
  const metaSave = useAutosave<{ framework_key?: FrameworkKey; minutes_played?: number | null; comment?: string | null }>(async (patch) => {
    const r = await updateIndividual(evaluation.id, patch);
    if (!r.error && patch.framework_key) router.refresh();
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });

  const set = (cid: string, patch: Partial<Row>) => {
    if (!editable) return;
    const next = { ...(rows[cid] ?? { score: null, fact: null, interpretation: null }), ...patch };
    setRows((prev) => ({ ...prev, [cid]: next }));
    scoreSave.queue({ [cid]: next });
  };

  const scores = useMemo(() => Object.entries(rows).map(([criterionId, r]) => ({ criterionId, score: r.score })), [rows]);
  const dims = useMemo(() => evaluationDimensions(version, fk, scores), [version, fk, scores]);
  const ipi = weightedIndex(Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, v.index])), version.dimensionWeights[fk]);
  const byDim = useMemo(() => Object.fromEntries(DIMENSIONS.map((d) => [d.code, applicableCriteria(version, fk, d.code)])) as Record<DimensionCode, ReturnType<typeof applicableCriteria>>, [version, fk]);
  const total = Object.values(byDim).reduce((a, l) => a + l.length, 0);
  const noted = Object.values(dims).reduce((a, d) => a + d.evaluated, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_140px]">
          <label className="text-sm font-medium">Poste réellement occupé
            <Select value={fk} disabled={!editable} onChange={(e) => { const v = e.target.value as FrameworkKey; setFk(v); metaSave.queue({ framework_key: v }, true); }}>
              {FRAMEWORK_KEYS.map((k) => <option key={k} value={k}>{FRAMEWORK_KEY_LABELS[k]}</option>)}
            </Select>
          </label>
          <label className="text-sm font-medium">Minutes jouées
            <input type="number" min={0} max={300} inputMode="numeric" disabled={!editable} value={minutes}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              onChange={(e) => { setMinutes(e.target.value); const n = e.target.value === "" ? null : Math.round(Number(e.target.value)); if (n == null || (n >= 0 && n <= 300)) metaSave.queue({ minutes_played: n }); }} />
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">Changer de poste change les critères techniques et les pondérations ; les notes déjà saisies sont conservées.</p>
        </section>

        <nav aria-label="Dimensions" className="flex flex-wrap gap-2">
          {DIMENSIONS.map((d) => (
            <a key={d.code} href={`#dim-${d.code}`} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted">
              {d.label} <span className="text-muted-foreground">{dims[d.code].evaluated}/{byDim[d.code].length}</span>
            </a>
          ))}
        </nav>

        {DIMENSIONS.map((d) => {
          const meta = version.dimensions.find((x) => x.code === d.code);
          return (
            <section key={d.code} id={`dim-${d.code}`} className="scroll-mt-20 rounded-xl border bg-card" aria-labelledby={`h-${d.code}`}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
                <h2 id={`h-${d.code}`} className="font-display text-xl font-bold uppercase">{d.label}</h2>
                <span className="text-sm tabular-nums">{dims[d.code].index == null ? <span className="text-muted-foreground">Non évalué</span> : <><strong>{fmt(dims[d.code].index)}</strong> · {levelOf(dims[d.code].index)}</>}</span>
                {meta?.description ? <p className="w-full text-xs text-muted-foreground">{meta.description}</p> : null}
              </header>
              <ul className="divide-y">
                {byDim[d.code].map((c) => {
                  const r = rows[c.id];
                  const w = version.criterionWeights[c.id]?.[fk];
                  return (
                    <li key={c.id} className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {c.label}
                          {w != null ? <span className="ml-1 text-xs text-muted-foreground">({w} %)</span> : null}
                        </span>
                        <div role="group" aria-label={`Note : ${c.label}`} className="flex gap-1">
                          {SCALE.map((s) => (
                            <button key={s.score} type="button" disabled={!editable} aria-pressed={r?.score === s.score} title={`${s.score} · ${s.label}`}
                              onClick={() => set(c.id, { score: r?.score === s.score ? null : s.score })}
                              className={cn("size-9 rounded-md border text-sm font-bold tabular-nums transition-colors disabled:cursor-not-allowed",
                                r?.score === s.score ? "border-fuchsia bg-fuchsia text-white" : "hover:bg-muted")}>
                              {s.score}
                            </button>
                          ))}
                          <button type="button" disabled={!editable} aria-pressed={!!r && r.score == null} title="Non évalué : ne pénalise pas"
                            onClick={() => set(c.id, { score: null })}
                            className={cn("h-9 rounded-md border px-2 text-xs font-semibold", r && r.score == null ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted")}>
                            N/E
                          </button>
                          <button type="button" aria-expanded={!!open[c.id]} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                            className={cn("flex h-9 items-center gap-1 rounded-md border px-2 text-xs", (r?.fact || r?.interpretation) && "border-primary-text text-primary-text")}
                            title="Fait observé et interprétation">
                            <MessageSquareText className="size-4" aria-hidden /><span className="sr-only">Observation pour {c.label}</span>
                            <ChevronDown className={cn("size-3 transition-transform", open[c.id] && "rotate-180")} aria-hidden />
                          </button>
                        </div>
                      </div>
                      {open[c.id] ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="text-xs font-medium">Fait observé
                            <Textarea rows={2} maxLength={1000} disabled={!editable} value={r?.fact ?? ""} placeholder="Ce qui s'est passé, objectivement (minute, action, zone)"
                              onChange={(e) => set(c.id, { fact: e.target.value || null })} />
                          </label>
                          <label className="text-xs font-medium">Interprétation de l&apos;évaluateur
                            <Textarea rows={2} maxLength={1000} disabled={!editable} value={r?.interpretation ?? ""} placeholder="Votre lecture de l'action"
                              onChange={(e) => set(c.id, { interpretation: e.target.value || null })} />
                          </label>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <section className="rounded-xl border bg-card p-4">
          <label className="text-sm font-medium">Commentaire général
            <Textarea rows={3} maxLength={2000} disabled={!editable} value={comment} placeholder="Synthèse de la prestation (comportements observables)"
              onChange={(e) => { setComment(e.target.value); metaSave.queue({ comment: e.target.value || null }); }} />
          </label>
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold uppercase">Synthèse</h2>
            <span className="flex flex-col items-end"><SaveIndicator state={scoreSave.state} /><SaveIndicator state={metaSave.state} /></span>
          </div>
          <p className="text-xs text-muted-foreground">{CONTEXT_LABELS[context]} · {FRAMEWORK_KEY_LABELS[fk]} · {noted}/{total} critères notés</p>
          <dl className="divide-y text-sm">
            {DIMENSIONS.map((d) => (
              <div key={d.code} className="flex items-center justify-between py-1.5">
                <dt>{d.label} <span className="text-xs text-muted-foreground">({version.dimensionWeights[fk]?.[d.code] ?? 0} %)</span></dt>
                <dd className="tabular-nums">{dims[d.code].index == null ? <span className="text-muted-foreground">N/E</span> : fmt(dims[d.code].index)}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Indice de cette évaluation</p>
            <p className="font-display text-4xl font-bold tabular-nums">{fmt(ipi)}</p>
            <p className="text-xs text-muted-foreground">{levelOf(ipi)}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">Les critères N/E sont exclus du calcul et ne pénalisent pas. L&apos;IPI de la joueuse n&apos;est publié qu&apos;au-delà du seuil d&apos;évaluations validées.</p>
        </div>
      </aside>
    </div>
  );
}
