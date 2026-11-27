"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { createTheme, saveSessionPatch } from "@/lib/training/actions";
import { SaveIndicator, useAutosave } from "./autosave";
import { AreaF, SelectF } from "./fields";
import type { StepProps } from "./types";

export function StepThemes({ data, perms, themes, refresh }: StepProps) {
  const s = data.session;
  const [v, setV] = useState({
    theme_id: s.theme_id ?? "",
    sub_theme_id: s.sub_theme_id ?? "",
    main_objective: s.main_objective ?? "",
    secondary_objectives: s.secondary_objectives ?? "",
    notes: s.notes ?? "",
  });
  const [specific, setSpecific] = useState<string[]>(s.specific_objectives);
  const [draft, setDraft] = useState("");
  const [newTheme, setNewTheme] = useState({ main: "", sub: "" });
  const [themeErr, setThemeErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { state, queue } = useAutosave((p: Record<string, unknown>) => saveSessionPatch(s.id, p), {
    onSaved: (p) => { if ("theme_id" in p || "sub_theme_id" in p) refresh(); },
  });
  const dis = !perms.editable;
  const err = state.fields ?? {};
  const set = (k: keyof typeof v, val: string | null) => { setV((o) => ({ ...o, [k]: val ?? "" })); queue({ [k]: val ?? null }); };

  const active = themes.filter((t) => !t.archived || t.id === v.theme_id || t.id === v.sub_theme_id);
  const mains = active.filter((t) => !t.parent_id);
  const subs = active.filter((t) => t.parent_id && t.parent_id === v.theme_id);
  // Thème saisi avant la bibliothèque (anciennes séances) : affiché pour mémoire.
  const legacy = !s.theme_id && s.theme ? s.theme : null;

  const addTheme = (kind: "main" | "sub") =>
    start(async () => {
      setThemeErr(null);
      const name = kind === "main" ? newTheme.main : newTheme.sub;
      const r = await createTheme(name, kind === "main" ? null : v.theme_id || null);
      if (!r.ok) { setThemeErr(r.error); return; }
      setNewTheme((o) => ({ ...o, [kind]: "" }));
      if (kind === "main") { setV((o) => ({ ...o, theme_id: r.id, sub_theme_id: "" })); queue({ theme_id: r.id, sub_theme_id: null }, true); }
      else { setV((o) => ({ ...o, sub_theme_id: r.id })); queue({ sub_theme_id: r.id }, true); }
    });

  const pushSpecific = (list: string[]) => { setSpecific(list); queue({ specific_objectives: list }, true); };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thèmes</CardTitle>
          <CardDescription>Choisis dans la bibliothèque du club ou crée un thème. <Link href="/entrainement/themes" className="font-semibold text-primary-text underline">Gérer les thèmes</Link></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {legacy ? <p className="rounded-md bg-accent px-3 py-2 text-xs">Thème saisi précédemment : <strong>{legacy}</strong>. Choisis-le ou crée-le dans la bibliothèque pour le relier.</p> : null}
          <SelectF name="theme_id" label="Thème principal" value={v.theme_id} empty="Choisir un thème…" options={mains.map((t) => ({ value: t.id, label: t.name }))} disabled={dis}
            onChange={(x) => { setV((o) => ({ ...o, theme_id: x ?? "", sub_theme_id: "" })); queue({ theme_id: x, sub_theme_id: null }); }} error={err.theme_id} />
          {perms.editable ? (
            <div className="flex items-end gap-2">
              <Field label="Nouveau thème principal" htmlFor="new-main" className="flex-1">
                <Input id="new-main" value={newTheme.main} maxLength={120} placeholder="Ex. Pressing haut" onChange={(e) => setNewTheme((o) => ({ ...o, main: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTheme("main"); } }} />
              </Field>
              <Button type="button" variant="outline" disabled={pending || newTheme.main.trim().length < 2} onClick={() => addTheme("main")}><Plus />Créer</Button>
            </div>
          ) : null}
          <SelectF name="sub_theme_id" label="Sous-thème" value={v.sub_theme_id} empty={v.theme_id ? "—" : "Choisis d'abord un thème"} options={subs.map((t) => ({ value: t.id, label: t.name }))} disabled={dis || !v.theme_id}
            onChange={(x) => set("sub_theme_id", x)} error={err.sub_theme_id} />
          {perms.editable && v.theme_id ? (
            <div className="flex items-end gap-2">
              <Field label="Nouveau sous-thème" htmlFor="new-sub" className="flex-1">
                <Input id="new-sub" value={newTheme.sub} maxLength={120} placeholder="Ex. Déclencheurs de pressing" onChange={(e) => setNewTheme((o) => ({ ...o, sub: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTheme("sub"); } }} />
              </Field>
              <Button type="button" variant="outline" disabled={pending || newTheme.sub.trim().length < 2} onClick={() => addTheme("sub")}><Plus />Créer</Button>
            </div>
          ) : null}
          {themeErr ? <p role="alert" className="text-xs font-medium text-danger">{themeErr}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div><CardTitle className="text-base">Objectifs</CardTitle><CardDescription>Général, secondaires et objectifs spécifiques mesurables.</CardDescription></div>
          <SaveIndicator state={state} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AreaF name="main_objective" label="Objectif principal" value={v.main_objective} onChange={(x) => set("main_objective", x)} maxLength={1000} rows={2} error={err.main_objective} disabled={dis} />
          <AreaF name="secondary_objectives" label="Objectifs secondaires" value={v.secondary_objectives} onChange={(x) => set("secondary_objectives", x)} maxLength={2000} rows={3} error={err.secondary_objectives} disabled={dis} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Objectifs spécifiques ({specific.length}/12)</p>
            {specific.length ? (
              <ol className="flex flex-col gap-1 text-sm">
                {specific.map((o, k) => (
                  <li key={`${k}-${o}`} className="flex items-start gap-2 rounded-md border px-2 py-1.5">
                    <span className="font-display font-bold text-primary-text">{k + 1}.</span>
                    <span className="flex-1">{o}</span>
                    {perms.editable ? <button type="button" className="text-muted-foreground hover:text-danger" aria-label={`Retirer l'objectif ${k + 1}`} onClick={() => pushSpecific(specific.filter((_, j) => j !== k))}><X className="size-4" /></button> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="text-xs text-muted-foreground">Aucun objectif spécifique.</p>}
            {perms.editable && specific.length < 12 ? (
              <div className="flex gap-2">
                <Input aria-label="Nouvel objectif spécifique" value={draft} maxLength={300} placeholder="Ex. 80 % de passes réussies sous pression"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { e.preventDefault(); pushSpecific([...specific, draft.trim()]); setDraft(""); } }} />
                <Button type="button" variant="outline" disabled={!draft.trim()} onClick={() => { pushSpecific([...specific, draft.trim()]); setDraft(""); }}><Plus />Ajouter</Button>
              </div>
            ) : null}
          </div>
          <AreaF name="notes" label="Remarques générales" value={v.notes} onChange={(x) => set("notes", x)} maxLength={2000} rows={2} disabled={dis} />
        </CardContent>
      </Card>
    </div>
  );
}
