"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { CATEGORY_LABELS } from "@/lib/phase2/labels";
import { saveDiagram, saveExercisePatch, updateItem } from "@/lib/training/actions";
import { fmtMin, itemDuration } from "@/lib/training/schedule";
import type { SheetData, SheetItem, VideoLink } from "@/lib/training/sheet-types";
import { cn } from "@/lib/utils";
import { SaveIndicator, useAutosave } from "./autosave";
import { AreaF, SelectF, TextF } from "./fields";
import { TacticalBoard } from "./tactical-board";
import type { StepProps } from "./types";

export function StepExercises({ data, perms, refresh }: StepProps) {
  const all = data.phases.flatMap((p) => p.items.map((i) => ({ item: i, phase: p.title })));
  const [current, setCurrent] = useState<string | null>(all[0]?.item.id ?? null);
  const sel = all.find((x) => x.item.id === current) ?? all[0];
  if (!all.length)
    return <Card className="p-6 text-center text-sm text-muted-foreground">Aucun exercice dans la séance. Ajoute-les à l&apos;étape <Link href="?etape=3" className="font-semibold text-primary-text underline">3. Construction</Link>.</Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Exercices de la séance" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {all.map(({ item, phase }, k) => {
          const done = !!(item.exercise.instructions || item.exercise.organisation);
          const drawn = !!(item.diagram_id || item.exercise.diagram_id || item.exercise.diagram_image);
          return (
            <button key={item.id} type="button" onClick={() => setCurrent(item.id)} aria-current={item.id === sel.item.id}
              className={cn("min-w-48 rounded-lg border p-2 text-left text-sm lg:min-w-0", item.id === sel.item.id ? "border-primary bg-primary/5" : "hover:bg-accent")}>
              <span className="block text-[11px] uppercase text-muted-foreground">{k + 1}. {phase}</span>
              <span className="block font-semibold leading-tight">{item.exercise.title}</span>
              <span className="mt-1 flex gap-1">
                <Badge variant={done ? "success" : "outline"}>{done ? "Consignes" : "Sans consignes"}</Badge>
                <Badge variant={drawn ? "success" : "outline"}>{drawn ? "Schéma" : "Sans schéma"}</Badge>
              </span>
            </button>
          );
        })}
      </nav>
      <ExerciseDetail key={sel.item.id} item={sel.item} data={data} editable={perms.editable} refresh={refresh} />
    </div>
  );
}

const TEXT_FIELDS: { k: keyof SheetItem["exercise"]; label: string; max: number; rows?: number }[] = [
  { k: "objective", label: "Objectif", max: 1000, rows: 2 },
  { k: "organisation", label: "Organisation", max: 3000, rows: 3 },
  { k: "instructions", label: "Consignes", max: 3000, rows: 3 },
  { k: "progression", label: "Déroulement / progression", max: 3000, rows: 3 },
  { k: "constraints", label: "Contraintes", max: 2000 },
  { k: "realisation_criteria", label: "Critères de réalisation", max: 2000 },
  { k: "success_criteria", label: "Critères de réussite", max: 2000 },
  { k: "coaching_points", label: "Points de coaching", max: 2000 },
  { k: "variables", label: "Variantes (évolutions / régressions)", max: 2000 },
  { k: "corrections", label: "Corrections attendues", max: 2000 },
];

function ExerciseDetail({ item, data, editable, refresh }: { item: SheetItem; data: SheetData; editable: boolean; refresh: () => void }) {
  const ex = item.exercise;
  const [v, setV] = useState(() => ({ ...ex }));
  const [links, setLinks] = useState<VideoLink[]>(ex.video_links);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [notes, setNotes] = useState(item.notes ?? "");
  const exSave = useAutosave((p: Record<string, unknown>) => saveExercisePatch(ex.id, p), { onSaved: (p) => { if ("title" in p) refresh(); } });
  const itemSave = useAutosave((p: Record<string, unknown>) => updateItem(item.id, p));
  const set = (k: string, val: string | number | null) => { setV((o) => ({ ...o, [k]: val })); exSave.queue({ [k]: val }); };
  const err = exSave.state.fields ?? {};
  const d = itemDuration(item);

  const own = item.diagram_id ? data.diagrams[item.diagram_id] : null;
  const shared = ex.diagram_id ? data.diagrams[ex.diagram_id] : null;
  const diagram = own ?? shared ?? null;

  const onSave = async (title: string, d: unknown, mode: "update" | "copy") => {
    let r;
    if (mode === "copy") r = await saveDiagram(null, title, d, { itemId: item.id });
    else if (own) r = await saveDiagram(own.id, title, d);
    else if (shared) r = await saveDiagram(shared.id, title, d);
    else r = await saveDiagram(null, title, d, { exerciseId: ex.id });
    if (r.ok) refresh();
    return r;
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Contenu pédagogique</CardTitle>
            <CardDescription>
              Exercice de la bibliothèque : les modifications s&apos;appliquent partout où il est utilisé.{" "}
              <Link href={`/entrainement/exercices/${ex.id}`} className="font-semibold text-primary-text underline">Voir la fiche</Link>
            </CardDescription>
          </div>
          <SaveIndicator state={exSave.state} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextF name="ex-title" label="Titre" value={v.title} onChange={(x) => set("title", x)} maxLength={120} error={err.title} disabled={!editable} className="sm:col-span-2" />
            <SelectF name="ex-cat" label="Catégorie" value={v.category} onChange={(x) => x && set("category", x)} options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} disabled={!editable} />
            <TextF name="ex-players" label="Nombre de joueuses" value={v.players_count} onChange={(x) => set("players_count", x)} maxLength={60} placeholder="Ex. 8 c 8 + 2 GB" disabled={!editable} />
            <TextF name="ex-dims" label="Dimensions de l'espace" value={v.dimensions} onChange={(x) => set("dimensions", x)} maxLength={60} placeholder="Ex. 40 x 30 m" disabled={!editable} />
            <TextF name="ex-equip" label="Matériel de l'exercice" value={v.equipment} onChange={(x) => set("equipment", x)} maxLength={1000} placeholder="Ex. 12 plots, 2 mini-buts" disabled={!editable} className="sm:col-span-2 lg:col-span-3" />
          </div>
          <p className="rounded-md bg-accent px-3 py-2 text-xs">
            Dans cette séance : <strong>{item.series ?? 1} série(s) × {item.duration_min ?? "?"} min</strong>
            {item.recovery_sec ? `, ${item.recovery_sec} s de récupération entre séries` : ""}{item.pause_after_min ? `, pause de ${item.pause_after_min} min après` : ""} = <strong>{fmtMin(d.total)}</strong>.{" "}
            <Link href="?etape=3" className="font-semibold text-primary-text underline">Modifier à l&apos;étape 3</Link>
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <AreaF key={f.k} name={`ex-${f.k}`} label={f.label} value={(v[f.k] as string | null) ?? ""} onChange={(x) => set(f.k, x)} maxLength={f.max} rows={f.rows ?? 2} error={err[f.k]} disabled={!editable} />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Vidéos de référence</p>
            {links.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {links.map((l, k) => (
                  <li key={`${l.url}-${k}`} className="flex items-center gap-2">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-primary-text hover:underline"><ExternalLink className="mr-1 inline size-3.5" />{l.title || l.url}</a>
                    {editable ? <button type="button" aria-label="Retirer la vidéo" onClick={() => { const n = links.filter((_, j) => j !== k); setLinks(n); exSave.queue({ video_links: n }, true); }}><X className="size-4 text-muted-foreground" /></button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">Aucune vidéo.</p>}
            {editable ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                <Input aria-label="Titre de la vidéo" className="h-9" value={newLink.title} maxLength={120} placeholder="Titre" onChange={(e) => setNewLink((o) => ({ ...o, title: e.target.value }))} />
                <Input aria-label="Lien de la vidéo" className="h-9" type="url" value={newLink.url} maxLength={500} placeholder="https://…" onChange={(e) => setNewLink((o) => ({ ...o, url: e.target.value }))} />
                <Button type="button" size="sm" className="h-9" disabled={!newLink.url.startsWith("https://")}
                  onClick={() => { const n = [...links, { title: newLink.title.trim() || "Vidéo", url: newLink.url.trim() }]; setLinks(n); exSave.queue({ video_links: n }, true); setNewLink({ title: "", url: "" }); }}><Plus />Ajouter</Button>
              </div>
            ) : null}
            {err.video_links ? <p className="text-xs text-danger">{err.video_links}</p> : null}
          </div>
          <div className="border-t pt-3">
            <div className="mb-1 flex items-center justify-between"><p className="text-sm font-medium">Consignes propres à cette séance</p><SaveIndicator state={itemSave.state} /></div>
            <AreaF name="item-notes" label="Précisions pour ce jour (n'affecte pas la bibliothèque)" value={notes} onChange={(x) => { setNotes(x); itemSave.queue({ notes: x }); }} maxLength={1000} rows={2} disabled={!editable} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tableau tactique</CardTitle>
          <CardDescription>
            {own ? "Version propre à cette séance." : shared ? "Schéma de l'exercice (bibliothèque)." : "Aucun schéma : dessine-le, il sera enregistré avec l'exercice."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!diagram && ex.diagram_image ? (
            <figure className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ex.diagram_image} alt={`Schéma importé de l'exercice ${ex.title}`} className="max-h-80 w-auto self-start rounded-md border" />
              <figcaption className="text-xs text-muted-foreground">Image importée précédemment. Tu peux la remplacer par un schéma éditable ci-dessous.</figcaption>
            </figure>
          ) : null}
          <TacticalBoard
            key={diagram?.id ?? "new"}
            initial={diagram?.data ?? null}
            title={diagram?.title ?? ex.title}
            readOnly={!editable}
            onSave={editable ? onSave : undefined}
            canCopy={!own}
            saveHint={own ? undefined : shared ? "« Enregistrer » met à jour le schéma de l'exercice dans la bibliothèque ; « version pour cette séance » n'affecte que cette fiche." : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
