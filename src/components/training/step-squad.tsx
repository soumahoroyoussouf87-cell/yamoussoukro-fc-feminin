"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { ATTENDANCE_LABELS } from "@/lib/phase2/labels";
import { countEquipment, EQUIP_LABELS } from "@/lib/training/diagram";
import { PARTICIPATION_LABELS } from "@/lib/training/load";
import { computeSchedule } from "@/lib/training/schedule";
import { saveEquipment } from "@/lib/training/actions";
import { SaveIndicator, useAutosave } from "./autosave";
import { ABSENT, AVAILABILITY, useAttendance } from "./attendance";
import type { StepProps } from "./types";

export function StepSquad(props: StepProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <AttendanceCard {...props} />
      <EquipmentCard {...props} />
    </div>
  );
}

function AttendanceCard({ data, perms }: StepProps) {
  const { rows, update, patch, state } = useAttendance(data);
  const total = useMemo(() => Math.round(computeSchedule(data.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items }))).total), [data.phases]);
  const dis = !perms.write || data.session.status === "archive";
  const players = new Map(data.players.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const r of rows) if (r.status) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const unavailable = data.players.filter((p) => p.availability && p.availability !== "disponible");

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Effectif et présences</CardTitle>
          <CardDescription>{rows.filter((r) => r.status).length}/{rows.length} saisies · {[...counts].map(([k, n]) => `${n} ${ATTENDANCE_LABELS[k].toLowerCase()}`).join(" · ") || "aucune saisie"}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={state} />
          {!dis ? (
            <Button type="button" size="sm" variant="outline"
              onClick={() => update((r) => r.map((x) => {
                if (x.status) return x;
                const p = players.get(x.player_id);
                if (p?.availability === "indisponible") return x;
                return { ...x, status: "present", participation: p?.availability === "restreinte" ? "adaptee" : "complete", minutes: x.minutes ?? (total || null) };
              }))}>
              <Wand2 />Présentes : les disponibles
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {unavailable.length ? (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            Disponibilité du jour : {unavailable.map((p) => `${p.short} (${AVAILABILITY[p.availability!]?.label.toLowerCase()})`).join(", ")}.
          </p>
        ) : null}
        {state.status === "error" ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">Joueuse</th><th className="px-2">Dispo.</th><th className="px-2">Présence</th><th className="px-2">Participation</th><th className="px-2">Observation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = players.get(r.player_id)!;
                const av = p.availability ? AVAILABILITY[p.availability] : null;
                return (
                  <tr key={r.player_id} className="border-b last:border-0">
                    <td className="px-2 py-1.5">
                      <span className="mr-1.5 inline-block w-6 text-right font-display font-bold text-primary-text">{p.shirt ?? ""}</span>
                      <span className="font-semibold">{p.short}</span>
                      {p.position ? <span className="ml-1 text-xs text-muted-foreground">{p.position}</span> : null}
                    </td>
                    <td className="px-2">{av ? <Badge variant={av.tone}>{av.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-2">
                      <Select aria-label={`Présence de ${p.name}`} className="h-8 min-w-36 text-xs" value={r.status ?? ""} disabled={dis}
                        onChange={(e) => patch(r.player_id, { status: e.target.value || null, participation: r.participation ?? (e.target.value && !ABSENT.includes(e.target.value) ? "complete" : null), minutes: r.minutes ?? (e.target.value && !ABSENT.includes(e.target.value) && total ? total : null) })}>
                        <option value="">—</option>
                        {Object.entries(ATTENDANCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </td>
                    <td className="px-2">
                      <Select aria-label={`Participation de ${p.name}`} className="h-8 min-w-28 text-xs" value={r.participation ?? ""} disabled={dis || !r.status || ABSENT.includes(r.status)}
                        onChange={(e) => patch(r.player_id, { participation: e.target.value || null })}>
                        <option value="">—</option>
                        {Object.entries(PARTICIPATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </td>
                    <td className="px-2">
                      <Input aria-label={`Observation pour ${p.name}`} className="h-8 text-xs" maxLength={300} defaultValue={r.note ?? ""} disabled={dis || !r.status}
                        onChange={(e) => patch(r.player_id, { note: e.target.value || null })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">La disponibilité vient du module Disponibilités ; aucun motif médical n&apos;est affiché ici.</p>
      </CardContent>
    </Card>
  );
}

function EquipmentCard({ data, perms }: StepProps) {
  const [rows, setRows] = useState(data.equipment);
  const [draft, setDraft] = useState({ item: "", quantity: 1 });
  const save = useAutosave((p: { rows: { item: string; quantity: number }[] }) => saveEquipment(data.session.id, p.rows), { delay: 800 });
  const dis = !perms.editable;
  const set = (next: typeof rows) => { setRows(next); save.queue({ rows: next.filter((r) => r.item.trim()) }); };

  // Matériel déduit des schémas de la séance (une fois par schéma utilisé).
  const fromDiagrams = useMemo(() => {
    const total = new Map<string, number>();
    const seen = new Set<string>();
    for (const i of data.phases.flatMap((p) => p.items)) {
      const id = i.diagram_id ?? i.exercise.diagram_id;
      if (!id || seen.has(id) || !data.diagrams[id]) continue;
      seen.add(id);
      for (const [k, n] of Object.entries(countEquipment(data.diagrams[id].data))) {
        if (k === "player") continue;
        const label = EQUIP_LABELS[k as keyof typeof EQUIP_LABELS];
        total.set(label, Math.max(total.get(label) ?? 0, n ?? 0));
      }
    }
    return [...total].map(([item, quantity]) => ({ item, quantity }));
  }, [data]);
  const exerciseNotes = [...new Set(data.phases.flatMap((p) => p.items.map((i) => i.exercise.equipment).filter(Boolean)))] as string[];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div><CardTitle className="text-base">Matériel</CardTitle><CardDescription>Liste imprimée sur la fiche.</CardDescription></div>
        <SaveIndicator state={save.state} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length ? (
          <ul className="flex flex-col gap-1.5">
            {rows.map((r, k) => (
              <li key={k} className="flex items-center gap-2">
                <Input aria-label="Quantité" type="number" min={0} max={999} className="h-8 w-20" value={r.quantity} disabled={dis}
                  onChange={(e) => set(rows.map((x, j) => (j === k ? { ...x, quantity: Math.max(0, Math.min(999, Number(e.target.value) || 0)) } : x)))} />
                <Input aria-label="Matériel" className="h-8" value={r.item} maxLength={80} disabled={dis} onChange={(e) => set(rows.map((x, j) => (j === k ? { ...x, item: e.target.value } : x)))} />
                {!dis ? <Button type="button" size="sm" variant="ghost" aria-label={`Retirer ${r.item}`} onClick={() => set(rows.filter((_, j) => j !== k))}><Trash2 /></Button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucun matériel listé.</p>}
        {!dis ? (
          <div className="flex gap-2">
            <Input aria-label="Quantité du nouveau matériel" type="number" min={0} max={999} className="h-9 w-20" value={draft.quantity} onChange={(e) => setDraft((o) => ({ ...o, quantity: Number(e.target.value) || 0 }))} />
            <Input aria-label="Nouveau matériel" className="h-9" value={draft.item} maxLength={80} placeholder="Ex. Chasubles roses"
              onKeyDown={(e) => { if (e.key === "Enter" && draft.item.trim()) { e.preventDefault(); set([...rows, { item: draft.item.trim(), quantity: draft.quantity }]); setDraft({ item: "", quantity: 1 }); } }}
              onChange={(e) => setDraft((o) => ({ ...o, item: e.target.value }))} />
            <Button type="button" size="sm" className="h-9" disabled={!draft.item.trim()} onClick={() => { set([...rows, { item: draft.item.trim(), quantity: draft.quantity }]); setDraft({ item: "", quantity: 1 }); }}><Plus /></Button>
          </div>
        ) : null}
        {!dis && fromDiagrams.length ? (
          <Button type="button" size="sm" variant="outline"
            onClick={() => {
              const next = [...rows];
              for (const f of fromDiagrams) {
                const k = next.findIndex((r) => r.item.toLowerCase() === f.item.toLowerCase());
                if (k >= 0) next[k] = { ...next[k], quantity: Math.max(next[k].quantity, f.quantity) };
                else next.push(f);
              }
              set(next);
            }}>
            <Wand2 />Reprendre le matériel des schémas ({fromDiagrams.map((f) => `${f.quantity} ${f.item.toLowerCase()}`).join(", ")})
          </Button>
        ) : null}
        {exerciseNotes.length ? <div className="text-xs text-muted-foreground"><p className="font-semibold">Indiqué dans les exercices :</p><ul className="list-disc pl-4">{exerciseNotes.map((n) => <li key={n}>{n}</li>)}</ul></div> : null}
        {data.session.legacy_equipment ? <p className="text-xs text-muted-foreground"><strong>Saisie précédente :</strong> {data.session.legacy_equipment}</p> : null}
      </CardContent>
    </Card>
  );
}
