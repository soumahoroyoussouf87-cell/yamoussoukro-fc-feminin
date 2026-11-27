"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { INTENSITY_LABELS } from "@/lib/phase2/labels";
import { SYSTEMS } from "@/lib/domain/formations";
import { saveSessionPatch } from "@/lib/training/actions";
import { fmtMin, plannedMinutes } from "@/lib/training/schedule";
import { SaveIndicator, useAutosave } from "./autosave";
import { SelectF, TextF } from "./fields";
import type { StepProps } from "./types";

const REFRESH = ["session_date", "starts_at", "ends_at", "responsible_staff_id"];
const PERIODS = ["Pré-saison", "Phase aller", "Trêve", "Phase retour", "Fin de saison", "Intersaison"];

export function StepInfos({ data, perms, staff, refresh }: StepProps) {
  const s = data.session;
  const [v, setV] = useState({
    session_date: s.session_date,
    starts_at: s.starts_at?.slice(0, 5) ?? "",
    ends_at: s.ends_at?.slice(0, 5) ?? "",
    location: s.location ?? "",
    period: s.period ?? "",
    game_system: s.game_system ?? "",
    audience: s.audience ?? "",
    responsible_staff_id: s.responsible_staff_id ?? "",
    weather: s.weather ?? "",
    pitch_condition: s.pitch_condition ?? "",
    intensity: s.intensity ?? "",
  });
  const { state, queue } = useAutosave((p: Record<string, unknown>) => saveSessionPatch(s.id, p), {
    onSaved: (p) => { if (Object.keys(p).some((k) => REFRESH.includes(k))) refresh(); },
  });
  const set = (k: keyof typeof v, val: string | null) => {
    setV((o) => ({ ...o, [k]: val ?? "" }));
    if (k === "session_date" && !val) return;
    queue({ [k]: val ?? null }, k === "session_date");
  };
  const err = state.fields ?? {};
  const dis = !perms.editable;
  const planned = plannedMinutes(v.starts_at || null, v.ends_at || null);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex justify-end"><SaveIndicator state={state} /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextF name="session_date" label="Date" type="date" value={v.session_date} onChange={(x) => set("session_date", x)} error={err.session_date} disabled={dis} />
          <TextF name="starts_at" label="Heure de début" type="time" value={v.starts_at} onChange={(x) => set("starts_at", x)} error={err.starts_at} disabled={dis} />
          <TextF name="ends_at" label="Heure de fin" type="time" value={v.ends_at} onChange={(x) => set("ends_at", x)} error={err.ends_at} disabled={dis} hint={planned ? `Durée prévue : ${fmtMin(planned)}` : undefined} />
          <TextF name="location" label="Lieu" value={v.location} onChange={(x) => set("location", x)} maxLength={120} placeholder="Ex. Stade municipal" error={err.location} disabled={dis} />
          <SelectF name="period" label="Période de la saison" value={v.period} onChange={(x) => set("period", x)} empty="—" options={[...new Set([...PERIODS, ...(v.period ? [v.period] : [])])].map((p) => ({ value: p, label: p }))} disabled={dis} />
          <SelectF name="game_system" label="Système de jeu travaillé" value={v.game_system} onChange={(x) => set("game_system", x)} empty="—" options={SYSTEMS.map((x) => ({ value: x, label: x }))} disabled={dis} />
          <TextF name="audience" label="Groupe concerné" value={v.audience} onChange={(x) => set("audience", x)} maxLength={120} placeholder="Ex. Groupe complet" disabled={dis} />
          <SelectF name="responsible_staff_id" label="Responsable de la séance" value={v.responsible_staff_id} onChange={(x) => set("responsible_staff_id", x)} empty="—"
            options={staff.length ? staff : s.responsible_staff_id && s.responsible ? [{ value: s.responsible_staff_id, label: s.responsible }] : []} disabled={dis} />
          <TextF name="weather" label="Météo" value={v.weather} onChange={(x) => set("weather", x)} maxLength={80} placeholder="Ex. Ensoleillé, 31 °C" disabled={dis} />
          <TextF name="pitch_condition" label="État du terrain" value={v.pitch_condition} onChange={(x) => set("pitch_condition", x)} maxLength={80} placeholder="Ex. Pelouse sèche" disabled={dis} />
          <SelectF name="intensity" label="Intensité prévue" value={v.intensity} onChange={(x) => set("intensity", x)} empty="—" options={Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label }))} disabled={dis} />
        </div>
        {s.match_ref ? <p className="text-sm text-muted-foreground">Référence au match : <strong className="text-foreground">{s.match_ref}</strong> (calculée depuis le calendrier des rencontres).</p> : null}
      </CardContent>
    </Card>
  );
}
