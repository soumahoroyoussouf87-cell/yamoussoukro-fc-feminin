"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { CATEGORY_LABELS } from "@/lib/phase2/labels";
import { saveDiagram, saveExercisePatch } from "@/lib/training/actions";
import type { Diagram } from "@/lib/training/diagram";
import type { SheetExercise, VideoLink } from "@/lib/training/sheet-types";
import { SaveIndicator, useAutosave } from "./autosave";
import { AreaF, NumF, SelectF, TextF } from "./fields";
import { TacticalBoard } from "./tactical-board";

const TEXTS: { k: keyof SheetExercise; label: string; max: number; rows?: number }[] = [
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

/** Édition d'un exercice de la bibliothèque : contenu pédagogique et schéma tactique éditable. */
export function ExerciseEditor({ exercise, diagram }: { exercise: SheetExercise; diagram: { id: string; title: string; data: Diagram } | null }) {
  const router = useRouter();
  const [v, setV] = useState({ ...exercise });
  const [links, setLinks] = useState<VideoLink[]>(exercise.video_links);
  const [draft, setDraft] = useState({ title: "", url: "" });
  const save = useAutosave((p: Record<string, unknown>) => saveExercisePatch(exercise.id, p));
  const set = (k: string, val: string | number | null) => { setV((o) => ({ ...o, [k]: val })); save.queue({ [k]: val }); };
  const err = save.state.fields ?? {};
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div><CardTitle className="text-base">Contenu de l&apos;exercice</CardTitle><CardDescription>Enregistrement automatique.</CardDescription></div>
          <SaveIndicator state={save.state} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextF name="title" label="Titre" value={v.title} onChange={(x) => set("title", x)} maxLength={120} error={err.title} className="sm:col-span-2" />
            <SelectF name="category" label="Catégorie" value={v.category} onChange={(x) => x && set("category", x)} options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            <NumF name="duration_min" label="Durée par série" suffix="min" value={v.duration_min} min={1} max={180} onChange={(x) => set("duration_min", x)} error={err.duration_min} />
            <NumF name="series" label="Séries" value={v.series} min={1} max={50} onChange={(x) => set("series", x)} error={err.series} />
            <TextF name="repetitions" label="Répétitions" value={v.repetitions} onChange={(x) => set("repetitions", x)} maxLength={60} placeholder="Ex. 4 x 4 min" />
            <TextF name="recovery" label="Récupération" value={v.recovery} onChange={(x) => set("recovery", x)} maxLength={60} placeholder="Ex. 1 min 30 passive" />
            <TextF name="players_count" label="Nombre de joueuses" value={v.players_count} onChange={(x) => set("players_count", x)} maxLength={60} placeholder="Ex. 8 c 8 + 2 GB" />
            <TextF name="dimensions" label="Dimensions" value={v.dimensions} onChange={(x) => set("dimensions", x)} maxLength={60} placeholder="Ex. 40 x 30 m" />
            <TextF name="equipment" label="Matériel" value={v.equipment} onChange={(x) => set("equipment", x)} maxLength={1000} className="sm:col-span-2 lg:col-span-3" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {TEXTS.map((f) => <AreaF key={f.k} name={f.k} label={f.label} value={(v[f.k] as string | null) ?? ""} onChange={(x) => set(f.k, x)} maxLength={f.max} rows={f.rows ?? 2} error={err[f.k]} />)}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Vidéos de référence</p>
            {links.map((l, k) => (
              <div key={`${l.url}-${k}`} className="flex items-center gap-2 text-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-primary-text hover:underline"><ExternalLink className="mr-1 inline size-3.5" />{l.title}</a>
                <button type="button" aria-label="Retirer la vidéo" onClick={() => { const n = links.filter((_, j) => j !== k); setLinks(n); save.queue({ video_links: n }, true); }}><X className="size-4 text-muted-foreground" /></button>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <Input aria-label="Titre de la vidéo" className="h-9" value={draft.title} maxLength={120} placeholder="Titre" onChange={(e) => setDraft((o) => ({ ...o, title: e.target.value }))} />
              <Input aria-label="Lien de la vidéo" className="h-9" type="url" value={draft.url} maxLength={500} placeholder="https://…" onChange={(e) => setDraft((o) => ({ ...o, url: e.target.value }))} />
              <Button type="button" size="sm" className="h-9" disabled={!draft.url.startsWith("https://")}
                onClick={() => { const n = [...links, { title: draft.title.trim() || "Vidéo", url: draft.url.trim() }]; setLinks(n); save.queue({ video_links: n }, true); setDraft({ title: "", url: "" }); }}><Plus />Ajouter</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Tableau tactique</CardTitle><CardDescription>Le schéma reste modifiable : il est enregistré sous forme de données, pas d&apos;image.</CardDescription></CardHeader>
        <CardContent>
          <TacticalBoard initial={diagram?.data ?? null} title={diagram?.title ?? exercise.title}
            onSave={async (title, data) => { const r = await saveDiagram(diagram?.id ?? null, title, data, diagram ? undefined : { exerciseId: exercise.id }); if (r.ok) router.refresh(); return r; }} />
        </CardContent>
      </Card>
    </div>
  );
}
