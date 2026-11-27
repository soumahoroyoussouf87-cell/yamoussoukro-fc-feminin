/**
 * Calcul du déroulement d'une séance : durées, horaires, pauses et récupérations.
 * Règles :
 *  - un exercice dure `séries × durée` + `(séries − 1) × récupération` ;
 *  - une pause éventuelle suit l'exercice ;
 *  - une phase sans exercice prend sa propre durée (ex. briefing 5 min).
 */
export type ScheduleItem = { id: string; duration_min: number | null; series: number | null; recovery_sec: number | null; pause_after_min: number | null };
export type SchedulePhase = { id: string; duration_min: number | null; items: ScheduleItem[] };

export type ItemTiming = { id: string; start: number; end: number; work: number; recovery: number; pause: number; total: number };
export type PhaseTiming = { id: string; start: number; end: number; total: number; items: ItemTiming[] };
export type Schedule = { phases: PhaseTiming[]; total: number; work: number; recovery: number; pauses: number };

export function itemDuration(i: ScheduleItem) {
  const series = Math.max(1, i.series ?? 1);
  const work = (i.duration_min ?? 0) * series;
  const recovery = ((series - 1) * (i.recovery_sec ?? 0)) / 60;
  const pause = i.pause_after_min ?? 0;
  return { work, recovery, pause, total: work + recovery + pause };
}

export function computeSchedule(phases: SchedulePhase[]): Schedule {
  let t = 0;
  let work = 0, recovery = 0, pauses = 0;
  const out: PhaseTiming[] = [];
  for (const p of phases) {
    const start = t;
    const items: ItemTiming[] = [];
    if (p.items.length) {
      for (const i of p.items) {
        const d = itemDuration(i);
        items.push({ id: i.id, start: t, end: t + d.work + d.recovery, ...d });
        t += d.total;
        work += d.work; recovery += d.recovery; pauses += d.pause;
      }
    } else {
      t += p.duration_min ?? 0;
      work += p.duration_min ?? 0;
    }
    out.push({ id: p.id, start, end: t, total: t - start, items });
  }
  return { phases: out, total: t, work, recovery, pauses };
}

/** « 17:00:00 » + 95 min → « 18h35 ». */
export function clockAt(startsAt: string | null | undefined, offsetMin: number) {
  if (!startsAt) return null;
  const [h, m] = startsAt.split(":").map(Number);
  const total = Math.round(h * 60 + m + offsetMin);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

/** Durée prévue par les horaires (min), ou null. */
export function plannedMinutes(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) return null;
  const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const d = toMin(endsAt) - toMin(startsAt);
  return d > 0 ? d : null;
}

export const fmtMin = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")} min`;
};
