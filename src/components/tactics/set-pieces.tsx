"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Plus, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SaveIndicator, useAutosave } from "@/components/training/autosave";
import { TacticalBoard, type RosterEntry } from "@/components/training/tactical-board";
import {
  archiveSetPiece, createSetPiece, deleteSetPiece, duplicateSetPiece, saveSetPieceDiagram, updateSetPiece, type SetPieceFormState,
} from "@/lib/tactics/set-piece-actions";
import type { Responsibility, SetPiece } from "@/lib/tactics/set-pieces";
import { CATEGORY_SINGULAR, SET_PIECE_CATEGORIES, SIDES, SIDE_LABELS, TAKER_LABEL, isDefensive, type SetPieceCategory } from "./set-piece-labels";

export function NewSetPieceForm({ defaultCategory }: { defaultCategory?: SetPieceCategory }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SetPieceFormState, FormData>(createSetPiece, undefined);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus />Nouvelle combinaison</Button>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" aria-label="Nouvelle combinaison">
      <Field label="Catégorie" htmlFor="sp-cat">
        <Select id="sp-cat" name="category" defaultValue={defaultCategory ?? "corner_off"}>
          {SET_PIECE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_SINGULAR[c]}</option>)}
        </Select>
      </Field>
      <Field label="Nom de la combinaison" htmlFor="sp-name"><Input id="sp-name" name="name" required minLength={2} maxLength={80} placeholder="Ex. Corner rentrant 1er poteau" /></Field>
      <Field label="Côté" htmlFor="sp-side">
        <Select id="sp-side" name="side" defaultValue="indifferent">{SIDES.map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}</Select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer et dessiner"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      {state?.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

type Patch = Partial<{
  name: string; category: SetPieceCategory; side: SetPiece["side"]; signal: string; instructions: string; notes: string;
  takers: string[]; responsibilities: Responsibility[];
}>;

export function SetPieceEditor({ sp, roster, editable }: { sp: SetPiece; roster: RosterEntry[]; editable: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<SetPieceCategory>(sp.category);
  const [takers, setTakers] = useState<string[]>(sp.takers);
  const [resp, setResp] = useState<Responsibility[]>(sp.responsibilities);
  const [armed, setArmed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = useAutosave<Patch>(async (patch) => {
    const r = await updateSetPiece(sp.id, patch);
    return r.error ? { ok: false, error: r.error } : { ok: true };
  });
  const nameOf = (id: string | null) => roster.find((r) => r.id === id);
  const label = (r?: RosterEntry) => (r ? `${r.number ? `${r.number} · ` : ""}${r.name}` : "—");

  const setT = (next: string[]) => { setTakers(next); save.queue({ takers: next }); };
  const setR = (next: Responsibility[], persist = true) => {
    setResp(next);
    // Une ligne sans rôle n'est pas encore envoyée (rôle obligatoire côté base).
    if (persist) save.queue({ responsibilities: next.filter((x) => x.role.trim().length >= 2) });
  };
  const act = (fn: () => Promise<{ error?: string } | undefined | void>) => start(async () => {
    setErr(null);
    const r = await fn();
    if (r && "error" in r && r.error) setErr(r.error);
  });

  const text = (key: "signal" | "instructions" | "notes", lbl: string, max: number, rows?: number, hint?: string) => (
    <label className="block text-sm font-medium">{lbl}
      {!editable ? <p className="mt-1 whitespace-pre-line font-normal text-muted-foreground">{sp[key] || "—"}</p>
        : rows ? <Textarea rows={rows} maxLength={max} defaultValue={sp[key] ?? ""} placeholder={hint} onChange={(e) => save.queue({ [key]: e.target.value })} className="mt-1 font-normal" />
          : <Input maxLength={max} defaultValue={sp[key] ?? ""} placeholder={hint} onChange={(e) => save.queue({ [key]: e.target.value })} className="mt-1 font-normal" />}
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Fiche de la combinaison" className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase">Fiche</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {editable ? <SaveIndicator state={save.state} /> : null}
            <a href={`/impression/cpa?id=${sp.id}`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"><Printer className="size-4" />Imprimer la fiche</a>
            {editable ? (
              <>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(async () => { const r = await duplicateSetPiece(sp.id); if (r.id) router.push(`/tactique/cpa/${r.id}`); return r; })}><Copy />Dupliquer</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => act(async () => { const r = await archiveSetPiece(sp.id, !sp.archived); if (!r.error) router.refresh(); return r; })}>
                  {sp.archived ? <><ArchiveRestore />Restaurer</> : <><Archive />Archiver</>}
                </Button>
                {armed ? (
                  <span className="inline-flex gap-1">
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => act(() => deleteSetPiece(sp.id))}>Supprimer définitivement</Button>
                    <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Annuler</Button>
                  </span>
                ) : <Button size="sm" variant="ghost" onClick={() => setArmed(true)}><Trash2 />Supprimer</Button>}
              </>
            ) : null}
          </div>
        </div>
        {err ? <p role="alert" className="mb-2 text-sm text-danger">{err}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium">Nom
            {editable ? <Input key={sp.name} id="sp-edit-name" maxLength={80} defaultValue={sp.name} onChange={(e) => { if (e.target.value.trim().length >= 2) save.queue({ name: e.target.value }); }} className="mt-1 font-normal" />
              : <p className="mt-1 font-normal">{sp.name}</p>}
          </label>
          <label className="block text-sm font-medium">Catégorie
            {editable ? (
              <Select value={category} onChange={(e) => { const c = e.target.value as SetPieceCategory; setCategory(c); save.queue({ category: c }); }} className="mt-1 font-normal">
                {SET_PIECE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_SINGULAR[c]}</option>)}
              </Select>
            ) : <p className="mt-1 font-normal">{CATEGORY_SINGULAR[category]}</p>}
          </label>
          <label className="block text-sm font-medium">Côté
            {editable ? (
              <Select defaultValue={sp.side} onChange={(e) => save.queue({ side: e.target.value as SetPiece["side"] })} className="mt-1 font-normal">
                {SIDES.map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
              </Select>
            ) : <p className="mt-1 font-normal">{SIDE_LABELS[sp.side]}</p>}
          </label>
          {text("signal", "Signal / code", 60, undefined, "Ex. main levée, « Abidjan »")}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {text("instructions", isDefensive(category) ? "Organisation et consignes" : "Déroulement et consignes", 3000, 6,
              isDefensive(category) ? "Ex. marquage mixte : 4 en zone (1er poteau, axe, 2e poteau, entrée de surface), 3 en individuel…" : "Ex. 1) appel au 1er poteau de la n°9 pour fixer, 2) ballon rentrant au point de penalty…")}
            {text("notes", "Remarques (adaptations, adversaires visés)", 2000, 3)}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{TAKER_LABEL(category)}</p>
              <ol className="mt-1 space-y-1">
                {takers.map((t, i) => (
                  <li key={`${t}-${i}`} className="flex items-center gap-1.5 text-sm">
                    <span className="w-5 text-right font-bold">{i + 1}.</span>
                    <span className="flex-1">{label(nameOf(t))}</span>
                    {editable ? (
                      <>
                        <Button type="button" size="sm" variant="ghost" aria-label="Monter" disabled={i === 0} onClick={() => { const n = [...takers]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setT(n); }}><ArrowUp /></Button>
                        <Button type="button" size="sm" variant="ghost" aria-label="Descendre" disabled={i === takers.length - 1} onClick={() => { const n = [...takers]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setT(n); }}><ArrowDown /></Button>
                        <Button type="button" size="sm" variant="ghost" aria-label="Retirer" onClick={() => setT(takers.filter((_, k) => k !== i))}><X /></Button>
                      </>
                    ) : null}
                  </li>
                ))}
                {!takers.length ? <li className="text-sm text-muted-foreground">Aucune joueuse désignée.</li> : null}
              </ol>
              {editable && takers.length < 5 ? (
                <Select aria-label="Ajouter une tireuse" className="mt-1 h-9" value="" onChange={(e) => { if (e.target.value) setT([...takers, e.target.value]); }}>
                  <option value="">+ Ajouter une joueuse…</option>
                  {roster.filter((r) => !takers.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
                </Select>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-medium">Responsabilités individuelles</p>
              <ul className="mt-1 space-y-1.5">
                {resp.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1.5 text-sm sm:flex-nowrap">
                    {editable ? (
                      <>
                        <Select aria-label={`Joueuse de la responsabilité ${i + 1}`} className="h-9 sm:w-44" value={r.player_id ?? ""}
                          onChange={(e) => setR(resp.map((x, k) => (k === i ? { ...x, player_id: e.target.value || null } : x)))}>
                          <option value="">— Poste / à définir —</option>
                          {roster.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                        </Select>
                        <Input aria-label={`Rôle ${i + 1}`} className="h-9 min-w-0 flex-1" maxLength={120} value={r.role} placeholder="Ex. bloc sur la gardienne, zone 1er poteau…"
                          onChange={(e) => setR(resp.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)))} />
                        <Button type="button" size="sm" variant="ghost" aria-label="Retirer la responsabilité" onClick={() => setR(resp.filter((_, k) => k !== i))}><X /></Button>
                      </>
                    ) : <span><strong>{r.player_id ? label(nameOf(r.player_id)) : "À définir"}</strong> : {r.role}</span>}
                  </li>
                ))}
                {!resp.length && !editable ? <li className="text-sm text-muted-foreground">Aucune responsabilité définie.</li> : null}
              </ul>
              {editable && resp.length < 14 ? (
                <Button type="button" size="sm" variant="outline" className="mt-1.5" onClick={() => setR([...resp, { player_id: null, role: "" }], false)}><Plus />Ajouter une responsabilité</Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Schéma de la combinaison" className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-bold uppercase">Schéma animé</h2>
        <p className="mb-3 text-xs text-muted-foreground">Place les joueuses (choisis-les dans l&apos;effectif pour afficher leur nom), le ballon, les courses et les zones. Ajoute des étapes pour montrer le mouvement.</p>
        <TacticalBoard initial={sp.diagram} title={sp.name} readOnly={!editable} roster={roster} printHref={`/impression/cpa?id=${sp.id}`}
          onSave={editable ? async (t, d) => { const r = await saveSetPieceDiagram(sp.id, t, d); if (!r.error) router.refresh(); return { ok: !r.error, error: r.error }; } : undefined}
          saveHint="Le schéma reste propre à cette combinaison (il n'est pas ajouté à la bibliothèque des schémas d'entraînement)." />
      </section>
    </div>
  );
}

