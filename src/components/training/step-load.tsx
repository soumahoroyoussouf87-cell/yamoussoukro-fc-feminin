"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ATTENDANCE_LABELS } from "@/lib/phase2/labels";
import { saveSessionPatch } from "@/lib/training/actions";
import { plannedLoad, teamLoad } from "@/lib/training/load";
import { computeSchedule, fmtMin } from "@/lib/training/schedule";
import type { VideoLink } from "@/lib/training/sheet-types";
import { SaveIndicator, useAutosave } from "./autosave";
import { ABSENT, useAttendance } from "./attendance";
import { SelectF } from "./fields";
import type { StepProps } from "./types";

export const RPE_LABELS: Record<number, string> = {
  0: "Repos", 1: "Très, très facile", 2: "Facile", 3: "Modéré", 4: "Assez difficile", 5: "Difficile", 6: "Difficile +", 7: "Très difficile", 8: "Très difficile +", 9: "Quasi maximal", 10: "Maximal",
};

export function StepLoad({ data, perms, refresh }: StepProps) {
  const s = data.session;
  const [rpe, setRpe] = useState<number | null>(s.planned_rpe);
  const [links, setLinks] = useState<VideoLink[]>(s.video_links);
  const [draft, setDraft] = useState({ title: "", url: "" });
  const sessionSave = useAutosave((p: Record<string, unknown>) => saveSessionPatch(s.id, p), { onSaved: refresh });
  const att = useAttendance(data);
  const total = useMemo(() => Math.round(computeSchedule(data.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items }))).total), [data.phases]);
  const planned = plannedLoad(rpe, total);
  const actual = teamLoad(att.rows);
  const present = att.rows.filter((r) => r.status && !ABSENT.includes(r.status));
  const players = new Map(data.players.map((p) => [p.id, p]));
  const disAtt = !perms.write || s.status === "archive";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Charge prévue</CardTitle><CardDescription>RPE prévu × durée programmée.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SelectF name="planned_rpe" label="RPE prévu (échelle 1 à 10)" value={rpe ? String(rpe) : ""} empty="—" disabled={!perms.editable}
              options={Array.from({ length: 10 }, (_, k) => ({ value: String(k + 1), label: `${k + 1} — ${RPE_LABELS[k + 1]}` }))}
              onChange={(x) => { const n = x ? Number(x) : null; setRpe(n); sessionSave.queue({ planned_rpe: n }, true); }} />
            <p className="text-sm">Durée programmée : <strong>{total ? fmtMin(total) : "—"}</strong></p>
            <p className="font-display text-3xl font-bold">{planned ?? "—"} <span className="text-sm font-normal text-muted-foreground">UA prévues</span></p>
            <SaveIndicator state={sessionSave.state} />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Charge réalisée (équipe)</CardTitle><CardDescription>Moyennes calculées sur les joueuses ayant minutes et RPE saisis.</CardDescription></CardHeader>
          <CardContent>
            {actual ? (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi k="RPE moyen" v={String(actual.rpe).replace(".", ",")} />
                <Kpi k="Minutes moyennes" v={`${actual.minutes}`} />
                <Kpi k="sRPE moyen" v={`${actual.srpe} UA`} />
                <Kpi k="Joueuses notées" v={`${actual.players}/${present.length}`} />
                {planned ? <p className="col-span-full text-sm">Écart avec la charge prévue : <strong>{actual.srpe - planned > 0 ? "+" : ""}{actual.srpe - planned} UA</strong> ({Math.round((actual.srpe / planned) * 100)} % du prévu).</p> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">Saisis les minutes et le RPE des joueuses ci-dessous après la séance.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="text-base">Charge individuelle</CardTitle><CardDescription>sRPE = minutes de participation × RPE ressenti (0 à 10), en unités arbitraires (UA).</CardDescription></div>
          <SaveIndicator state={att.state} />
        </CardHeader>
        <CardContent>
          {present.length === 0 ? <p className="text-sm text-muted-foreground">Aucune joueuse présente saisie : renseigne d&apos;abord les présences à l&apos;étape 5.</p> : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="px-2 py-2">Joueuse</th><th className="px-2">Présence</th><th className="px-2">Minutes</th><th className="px-2">RPE</th><th className="px-2 text-right">sRPE</th></tr></thead>
                <tbody>
                  {present.map((r) => {
                    const p = players.get(r.player_id)!;
                    return (
                      <tr key={r.player_id} className="border-b last:border-0">
                        <td className="px-2 py-1.5"><span className="mr-1.5 inline-block w-6 text-right font-display font-bold text-primary-text">{p.shirt ?? ""}</span><span className="font-semibold">{p.short}</span></td>
                        <td className="px-2 text-xs">{ATTENDANCE_LABELS[r.status!]}</td>
                        <td className="px-2"><Input aria-label={`Minutes de ${p.name}`} type="number" min={0} max={300} className="h-8 w-20" defaultValue={r.minutes ?? ""} disabled={disAtt}
                          onChange={(e) => att.patch(r.player_id, { minutes: e.target.value === "" ? null : Math.max(0, Math.min(300, Math.round(Number(e.target.value)))) })} /></td>
                        <td className="px-2">
                          <select aria-label={`RPE de ${p.name}`} className="h-8 rounded-md border border-input bg-card px-2 text-sm" value={r.rpe ?? ""} disabled={disAtt}
                            onChange={(e) => att.patch(r.player_id, { rpe: e.target.value === "" ? null : Number(e.target.value) })}>
                            <option value="">—</option>
                            {Array.from({ length: 11 }, (_, k) => <option key={k} value={k}>{k} — {RPE_LABELS[k]}</option>)}
                          </select>
                        </td>
                        <td className="px-2 text-right font-semibold tabular-nums">{r.minutes != null && r.rpe != null ? `${r.minutes * r.rpe} UA` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Analyse vidéo</CardTitle><CardDescription>Liens vers les vidéos de la séance (captation, montages, références).</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {links.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {links.map((l, k) => (
                <li key={`${l.url}-${k}`} className="flex items-center gap-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-primary-text hover:underline"><ExternalLink className="mr-1 inline size-3.5" />{l.title || l.url}</a>
                  {perms.editable ? <button type="button" aria-label="Retirer la vidéo" onClick={() => { const n = links.filter((_, j) => j !== k); setLinks(n); sessionSave.queue({ video_links: n }, true); }}><X className="size-4 text-muted-foreground" /></button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Aucune vidéo liée.</p>}
          {perms.editable ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <Input aria-label="Titre de la vidéo" className="h-9" value={draft.title} maxLength={120} placeholder="Ex. Jeu réduit 8c8 — caméra tribune" onChange={(e) => setDraft((o) => ({ ...o, title: e.target.value }))} />
              <Input aria-label="Lien de la vidéo" className="h-9" type="url" value={draft.url} maxLength={500} placeholder="https://…" onChange={(e) => setDraft((o) => ({ ...o, url: e.target.value }))} />
              <Button type="button" size="sm" className="h-9" disabled={!draft.url.startsWith("https://")}
                onClick={() => { const n = [...links, { title: draft.title.trim() || "Vidéo", url: draft.url.trim() }]; setLinks(n); sessionSave.queue({ video_links: n }, true); setDraft({ title: "", url: "" }); }}><Plus />Ajouter</Button>
            </div>
          ) : null}
          {sessionSave.state.fields?.video_links ? <p className="text-xs text-danger">{sessionSave.state.fields.video_links}</p> : null}
          <p className="pt-2 text-xs text-muted-foreground">Les données GPS et le questionnaire de bien-être seront reliés à la séance avec le module Performance (phase 3).</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="font-display text-2xl font-bold">{v}</dd></div>;
}
