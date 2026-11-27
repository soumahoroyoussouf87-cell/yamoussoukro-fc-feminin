"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/phase2/action-button";
import { DIMENSIONS, FRAMEWORK_KEYS, FRAMEWORK_KEY_LABELS, type DimensionCode, type FrameworkKey } from "@/lib/performance/engine";
import {
  addCriterion, deleteCriterion, deleteDraft, publishVersion, setCriterionWeight, setDimensionWeight, updateCriterion, updateDraft,
} from "@/lib/performance/actions";
import type { VersionFull } from "@/lib/performance/data";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const parse = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : NaN;
};

/** Cellule de poids : enregistre à la sortie du champ. */
function WeightCell({ value, onSave, editable, label, allowEmpty }: { value: number | null; onSave: (v: number | null) => Promise<{ error?: string }>; editable: boolean; label: string; allowEmpty?: boolean }) {
  const [text, setText] = useState(value == null ? "" : fmt(value));
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  if (!editable) return <span className={cn("tabular-nums", value == null && "text-muted-foreground")}>{value == null ? "—" : fmt(value)}</span>;
  const commit = async () => {
    const v = parse(text);
    if (Number.isNaN(v) || (v == null && !allowEmpty)) {
      setState("error");
      setErr("0 à 100");
      return;
    }
    if (v === value) return;
    setState("saving");
    const r = await onSave(v);
    if (r.error) {
      setState("error");
      setErr(r.error);
    } else {
      setState("idle");
      setErr(null);
    }
  };
  return (
    <span className="inline-flex flex-col items-center">
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn("h-8 w-14 rounded border bg-card px-1 text-center text-sm tabular-nums", state === "error" && "border-danger", state === "saving" && "opacity-60")}
      />
      {err ? <span className="text-[10px] text-danger">{err}</span> : null}
    </span>
  );
}

function Total({ value }: { value: number }) {
  const ok = Math.abs(value - 100) < 0.001;
  return <span className={cn("font-semibold tabular-nums", ok ? "text-success" : "text-danger")}>{fmt(value)}{ok ? "" : " ≠ 100"}</span>;
}

export function FrameworkEditor({ version, editable }: { version: VersionFull; editable: boolean }) {
  const router = useRouter();
  const [dimW, setDimW] = useState(version.dimensionWeights);
  const [critW, setCritW] = useState(version.criterionWeights);
  const [label, setLabel] = useState(version.label);
  const [notes, setNotes] = useState(version.notes ?? "");
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const tech = useMemo(() => version.criteria.filter((c) => c.dimension === "technique"), [version.criteria]);
  const techTotals = useMemo(() => {
    const t = {} as Record<FrameworkKey, number>;
    for (const k of FRAMEWORK_KEYS) t[k] = tech.reduce((a, c) => a + (critW[c.id]?.[k] ?? 0), 0);
    return t;
  }, [tech, critW]);
  const usedTech = tech.filter((c) => FRAMEWORK_KEYS.some((k) => (critW[c.id]?.[k] ?? 0) > 0));
  const unusedTech = tech.filter((c) => !usedTech.includes(c));
  const [showCommon, setShowCommon] = useState(false);

  const saveDim = (k: FrameworkKey, d: DimensionCode) => async (v: number | null) => {
    const r = await setDimensionWeight(version.id, k, d, v ?? 0);
    if (!r.error) setDimW((w) => ({ ...w, [k]: { ...w[k], [d]: v ?? 0 } }));
    return r;
  };
  const saveCrit = (cid: string, k: FrameworkKey) => async (v: number | null) => {
    const r = await setCriterionWeight(version.id, cid, k, v === 0 ? null : v);
    if (!r.error) setCritW((w) => {
      const row = { ...(w[cid] ?? {}) };
      if (v == null || v === 0) delete row[k];
      else row[k] = v;
      return { ...w, [cid]: row };
    });
    return r;
  };

  const run = (fn: () => Promise<{ error?: string } | void>, ok?: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r && r.error) setMsg(r.error);
      else {
        if (ok) setMsg(ok);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {editable ? (
        <section className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <p className="text-sm"><strong>Brouillon.</strong> Les évaluations en cours continuent d&apos;utiliser la version publiée. À la publication, cette version remplace la précédente pour les nouvelles évaluations ; les évaluations passées gardent leur version.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="text-sm font-medium">Nom de la version
              <Input value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== version.label && run(() => updateDraft(version.id, { label }))} />
            </label>
            <label className="text-sm font-medium">Notes de version
              <Input value={notes} maxLength={2000} placeholder="Ce qui change par rapport à la version précédente" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (version.notes ?? "") && run(() => updateDraft(version.id, { notes }))} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={pending} onClick={() => run(() => publishVersion(version.id), "Version publiée.")}>Publier cette version</Button>
            <ActionButton action={() => deleteDraft(version.id)} confirm="Supprimer le brouillon">Supprimer le brouillon</ActionButton>
            {msg ? <span role="status" className={cn("text-sm", /publiée/.test(msg) ? "text-success" : "text-danger")}>{msg}</span> : null}
          </div>
        </section>
      ) : null}

      {/* Pondérations globales */}
      <section aria-labelledby="dimw">
        <h2 id="dimw" className="font-display text-xl font-bold uppercase">Pondérations globales par poste</h2>
        <p className="mb-2 text-sm text-muted-foreground">En %. L&apos;IPI combine les dimensions évaluées avec ces poids ; une dimension non évaluée est retirée du calcul.</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Poste</th>{DIMENSIONS.map((d) => <th key={d.code} className="p-2 text-center">{d.label}</th>)}<th className="p-2 text-center">Total</th></tr>
            </thead>
            <tbody>
              {FRAMEWORK_KEYS.map((k) => {
                const total = DIMENSIONS.reduce((a, d) => a + (dimW[k]?.[d.code] ?? 0), 0);
                return (
                  <tr key={k} className="border-t">
                    <th scope="row" className="p-2 text-left font-medium">{FRAMEWORK_KEY_LABELS[k]}</th>
                    {DIMENSIONS.map((d) => (
                      <td key={d.code} className="p-2 text-center">
                        <WeightCell value={dimW[k]?.[d.code] ?? 0} editable={editable} label={`${FRAMEWORK_KEY_LABELS[k]} — ${d.label}`} onSave={saveDim(k, d.code)} />
                      </td>
                    ))}
                    <td className="p-2 text-center"><Total value={total} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Référentiel technique par poste */}
      <section aria-labelledby="techw">
        <h2 id="techw" className="font-display text-xl font-bold uppercase">Référentiels techniques par poste</h2>
        <p className="mb-2 text-sm text-muted-foreground">{version.dimensions.find((d) => d.code === "technique")?.description} Poids en % ; « — » = geste non évalué pour ce poste.</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2 text-left">Geste technique</th>{FRAMEWORK_KEYS.map((k) => <th key={k} className="p-2 text-center" title={FRAMEWORK_KEY_LABELS[k]}>{k.replace("_", "/")}</th>)}{editable ? <th className="p-2" /> : null}</tr>
            </thead>
            <tbody>
              {(showCommon || editable ? [...usedTech, ...unusedTech] : usedTech).map((c) => (
                <tr key={c.id} className="border-t">
                  <th scope="row" className="p-2 text-left font-medium">
                    <CriterionLabel id={c.id} label={c.label} editable={editable} onDone={() => router.refresh()} />
                  </th>
                  {FRAMEWORK_KEYS.map((k) => (
                    <td key={k} className="p-1 text-center">
                      <WeightCell value={critW[c.id]?.[k] ?? null} editable={editable} allowEmpty label={`${c.label} — ${FRAMEWORK_KEY_LABELS[k]}`} onSave={saveCrit(c.id, k)} />
                    </td>
                  ))}
                  {editable ? <td className="p-1"><ActionButton variant="ghost" action={() => deleteCriterion(c.id)} confirm="Supprimer"><Trash2 className="size-4" /><span className="sr-only">Supprimer {c.label}</span></ActionButton></td> : null}
                </tr>
              ))}
              <tr className="border-t bg-muted/20">
                <th scope="row" className="p-2 text-left">Total</th>
                {FRAMEWORK_KEYS.map((k) => <td key={k} className="p-2 text-center"><Total value={techTotals[k]} /></td>)}
                {editable ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
        {!editable && unusedTech.length ? (
          <button type="button" className="mt-2 text-sm text-primary-text underline" onClick={() => setShowCommon((s) => !s)}>
            {showCommon ? "Masquer" : "Afficher"} les {unusedTech.length} gestes du référentiel commun sans pondération de poste
          </button>
        ) : null}
        {editable ? <AddCriterion value={adding.technique ?? ""} onChange={(v) => setAdding((a) => ({ ...a, technique: v }))} onAdd={() => run(() => addCriterion(version.id, "technique", adding.technique ?? ""), "Geste ajouté.")} /> : null}
      </section>

      {/* Autres dimensions */}
      {version.dimensions.filter((d) => d.code !== "technique").map((d) => {
        const list = version.criteria.filter((c) => c.dimension === d.code);
        return (
          <section key={d.code} aria-labelledby={`dim-${d.code}`}>
            <h2 id={`dim-${d.code}`} className="font-display text-xl font-bold uppercase">{d.label} <Badge variant="outline">{list.length} critères</Badge></h2>
            {d.description ? <p className="mb-2 text-sm text-muted-foreground">{d.description}</p> : null}
            <ul className="divide-y rounded-xl border">
              {list.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-2.5 text-sm">
                  <span className="min-w-0 flex-1"><CriterionLabel id={c.id} label={c.label} editable={editable} onDone={() => router.refresh()} /></span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    Poids
                    <WeightCell value={c.defaultWeight} editable={editable} label={`Poids de ${c.label}`} onSave={(v) => updateCriterion(c.id, { default_weight: v ?? 1 })} />
                  </span>
                  {editable ? <ActionButton variant="ghost" action={() => deleteCriterion(c.id)} confirm="Supprimer"><Trash2 className="size-4" /><span className="sr-only">Supprimer {c.label}</span></ActionButton> : null}
                </li>
              ))}
            </ul>
            {editable ? <AddCriterion value={adding[d.code] ?? ""} onChange={(v) => setAdding((a) => ({ ...a, [d.code]: v }))} onAdd={() => run(() => addCriterion(version.id, d.code, adding[d.code] ?? ""), "Critère ajouté.")} /> : null}
          </section>
        );
      })}
    </div>
  );
}

function CriterionLabel({ id, label, editable, onDone }: { id: string; label: string; editable: boolean; onDone: () => void }) {
  const [text, setText] = useState(label);
  const [err, setErr] = useState<string | null>(null);
  if (!editable) return <>{label}</>;
  return (
    <span className="flex flex-col">
      <input
        aria-label="Libellé du critère"
        value={text}
        maxLength={120}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text.trim() === label) return;
          const r = await updateCriterion(id, { label: text });
          setErr(r.error ?? null);
          if (!r.error) onDone();
        }}
        className="h-8 w-full min-w-40 rounded border bg-card px-2 text-sm"
      />
      {err ? <span className="text-xs text-danger">{err}</span> : null}
    </span>
  );
}

function AddCriterion({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim().length >= 2) { onAdd(); onChange(""); } }}>
      <Input value={value} maxLength={120} placeholder="Nouveau critère" onChange={(e) => onChange(e.target.value)} className="max-w-sm" aria-label="Nouveau critère" />
      <Button type="submit" variant="outline" size="sm"><Plus className="size-4" />Ajouter</Button>
    </form>
  );
}
