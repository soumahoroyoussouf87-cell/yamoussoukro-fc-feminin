/**
 * Performance collective (cahier des charges §9, §25-§27, §29). Fonctions pures, testées dans
 * tests/unit/collective-engine.test.ts.
 *
 * - IPC : indice de chaque moment du jeu = moyenne des principes notés (1-5 → ×20, N/E exclu),
 *   puis pondération des moments (25/30/15/20/10 par défaut) renormalisée sur les moments évalués.
 *   Jamais calculé à partir des notes individuelles.
 * - IMP : part des principes maîtrisés (moyenne ≥ 60, « Acquis ») par moment, pondérée comme l'IPC.
 * - IPS / IPR : moyenne des critères de chaque secteur / relation, puis moyenne des secteurs / relations évalués.
 * - IDC / IDS : progression entre la première et la dernière évaluation comparable.
 */
import { mean, round1, scoreToIndex, type Comparison, type Reliability, reliabilityOf } from "./engine";

export const MOMENTS = [
  { code: "organisation_offensive", label: "Organisation offensive", short: "Org. offensive" },
  { code: "organisation_defensive", label: "Organisation défensive", short: "Org. défensive" },
  { code: "transition_offensive", label: "Transition offensive", short: "Trans. offensive" },
  { code: "transition_defensive", label: "Transition défensive", short: "Trans. défensive" },
  { code: "cpa", label: "Coups de pied arrêtés", short: "CPA" },
] as const;
export type MomentCode = (typeof MOMENTS)[number]["code"];
export const MOMENT_LABELS = Object.fromEntries(MOMENTS.map((m) => [m.code, m.label])) as Record<MomentCode, string>;

export const SECTORS = [
  { code: "gardiennes", label: "Gardiennes" }, { code: "defense", label: "Défense" }, { code: "milieu", label: "Milieu" },
  { code: "attaque", label: "Attaque" }, { code: "couloir_droit", label: "Couloir droit" }, { code: "couloir_gauche", label: "Couloir gauche" },
  { code: "axe_central", label: "Axe central" },
] as const;
export const SECTOR_CRITERIA = [
  { code: "coordination", label: "Coordination" }, { code: "complementarite", label: "Complémentarité" }, { code: "equilibre", label: "Équilibre" },
  { code: "communication", label: "Communication" }, { code: "responsabilites", label: "Responsabilités collectives" },
] as const;
export const RELATIONS = [
  { code: "gb_defense", label: "Gardienne – défense" }, { code: "defense_milieu", label: "Défense – milieu" },
  { code: "milieu_attaque", label: "Milieu – attaque" }, { code: "defense_attaque", label: "Défense – attaque" },
  { code: "laterale_ailiere", label: "Latérale – ailière" }, { code: "dc_sentinelle", label: "Défenseure centrale – sentinelle" },
  { code: "sentinelle_relayeuse", label: "Sentinelle – relayeuse" }, { code: "n10_attaquante", label: "Milieu offensive – attaquante" },
] as const;
export const RELATION_CRITERIA = [
  { code: "distances", label: "Distances entre les lignes" }, { code: "connexions", label: "Connexions" },
  { code: "synchronisation", label: "Synchronisation des déplacements" }, { code: "compensations", label: "Compensations" },
] as const;
/** Relations entre lignes pour lesquelles une distance se mesure (compacité). */
export const LINE_RELATIONS = ["gb_defense", "defense_milieu", "milieu_attaque", "defense_attaque"] as const;
export const SITUATIONS = [
  { code: "bloc_bas", label: "Bloc bas" }, { code: "bloc_median", label: "Bloc médian" }, { code: "bloc_haut", label: "Bloc haut" },
  { code: "possession", label: "Possession" }, { code: "transition", label: "Transition" },
] as const;
export const SECTOR_LABELS = Object.fromEntries(SECTORS.map((s) => [s.code, s.label])) as Record<string, string>;
export const RELATION_LABELS = Object.fromEntries(RELATIONS.map((s) => [s.code, s.label])) as Record<string, string>;
export const SITUATION_LABELS = Object.fromEntries(SITUATIONS.map((s) => [s.code, s.label])) as Record<string, string>;

export const SYSTEM_PHASES = [
  { code: "reference", label: "Système de référence" }, { code: "possession", label: "En possession" },
  { code: "hors_possession", label: "Hors possession" }, { code: "transition_offensive", label: "Transition offensive" },
  { code: "transition_defensive", label: "Transition défensive" },
] as const;
export const SYSTEM_PHASE_LABELS = Object.fromEntries(SYSTEM_PHASES.map((s) => [s.code, s.label])) as Record<string, string>;

export type GameVersionModel = {
  id: string;
  versionNo: number;
  label: string;
  moments: { id: string; code: MomentCode; label: string; weight: number; description?: string | null }[];
  principles: { id: string; code: string; label: string; moment: MomentCode; sortOrder?: number }[];
};

export type CollectiveScore = { kind: "principe" | "secteur" | "relation"; unit: string; criterion: string; score: number | null };
export type CollectiveMeasure = { relation: string; situation: string; distance: number; targetMin: number | null; targetMax: number | null };
export type CollectiveObservation = {
  id: string; date: string; context: "match" | "entrainement"; versionId: string;
  scores: CollectiveScore[]; measures: CollectiveMeasure[];
};

type UnitIndex = { index: number | null; evaluated: number; total: number };

/** Pondération des moments évalués (renormalisée). */
export function weightedMoments(indices: Partial<Record<MomentCode, number | null>>, v: GameVersionModel): number | null {
  let num = 0;
  let den = 0;
  for (const m of v.moments) {
    const x = indices[m.code];
    if (x == null || m.weight <= 0) continue;
    num += x * m.weight;
    den += m.weight;
  }
  return den > 0 ? round1(num / den) : null;
}

function groupMean(scores: CollectiveScore[], kind: CollectiveScore["kind"], units: readonly { code: string }[], criteria: readonly { code: string }[]) {
  const out: Record<string, UnitIndex> = {};
  for (const u of units) {
    const vals = scores.filter((s) => s.kind === kind && s.unit === u.code && criteria.some((c) => c.code === s.criterion))
      .map((s) => scoreToIndex(s.score)).filter((x): x is number => x != null);
    out[u.code] = { index: mean(vals), evaluated: vals.length, total: criteria.length };
  }
  return out;
}

export function inTarget(m: CollectiveMeasure): boolean | null {
  if (m.targetMin == null || m.targetMax == null) return null;
  return m.distance >= m.targetMin && m.distance <= m.targetMax;
}

/** Indices d'une seule évaluation collective. */
export function evaluateCollective(v: GameVersionModel, o: Pick<CollectiveObservation, "scores" | "measures">) {
  const byCode = new Map(o.scores.filter((s) => s.kind === "principe").map((s) => [s.unit, s.score]));
  const moments = {} as Record<MomentCode, UnitIndex>;
  const principles: Record<string, number> = {};
  for (const m of v.moments) {
    const list = v.principles.filter((p) => p.moment === m.code);
    const vals: number[] = [];
    for (const p of list) {
      const idx = scoreToIndex(byCode.get(p.code));
      if (idx == null) continue;
      vals.push(idx);
      principles[p.code] = idx;
    }
    moments[m.code] = { index: mean(vals), evaluated: vals.length, total: list.length };
  }
  const sectors = groupMean(o.scores, "secteur", SECTORS, SECTOR_CRITERIA);
  const relations = groupMean(o.scores, "relation", RELATIONS, RELATION_CRITERIA);
  const sectorVals = Object.values(sectors).map((s) => s.index).filter((x): x is number => x != null);
  const relationVals = Object.values(relations).map((s) => s.index).filter((x): x is number => x != null);
  const checked = o.measures.map(inTarget).filter((x): x is boolean => x != null);
  return {
    moments,
    principles,
    ipc: weightedMoments(Object.fromEntries(Object.entries(moments).map(([k, x]) => [k, x.index])), v),
    sectors,
    ips: mean(sectorVals),
    relations,
    ipr: mean(relationVals),
    compactness: { measured: o.measures.length, checked: checked.length, inTarget: checked.filter(Boolean).length },
  };
}

export type TeamIndices = ReturnType<typeof aggregateTeam>;

/**
 * Agrège les évaluations collectives validées d'une période. `reference` = projet de jeu publié
 * (pondérations des moments, liste des principes pour la couverture et l'IMP).
 */
export function aggregateTeam(obs: CollectiveObservation[], versions: Map<string, GameVersionModel>, reference: GameVersionModel, minObservations: number) {
  const list = obs.filter((o) => versions.has(o.versionId)).sort((a, b) => a.date.localeCompare(b.date));
  const perMoment: Record<string, number[]> = {};
  const perPrinciple = new Map<string, number[]>();
  const perSector: Record<string, number[]> = {};
  const perRelation: Record<string, number[]> = {};
  const timeline: { id: string; date: string; context: CollectiveObservation["context"]; versionId: string; ipc: number | null; ips: number | null; ipr: number | null }[] = [];
  const measures: (CollectiveMeasure & { date: string; evaluationId: string; ok: boolean | null })[] = [];

  for (const o of list) {
    const v = versions.get(o.versionId)!;
    const e = evaluateCollective(v, o);
    for (const [k, x] of Object.entries(e.moments)) if (x.index != null) (perMoment[k] ??= []).push(x.index);
    for (const [k, x] of Object.entries(e.principles)) (perPrinciple.get(k) ?? perPrinciple.set(k, []).get(k)!).push(x);
    for (const [k, x] of Object.entries(e.sectors)) if (x.index != null) (perSector[k] ??= []).push(x.index);
    for (const [k, x] of Object.entries(e.relations)) if (x.index != null) (perRelation[k] ??= []).push(x.index);
    timeline.push({ id: o.id, date: o.date, context: o.context, versionId: o.versionId, ipc: e.ipc, ips: e.ips, ipr: e.ipr });
    for (const m of o.measures) measures.push({ ...m, date: o.date, evaluationId: o.id, ok: inTarget(m) });
  }

  const moments = Object.fromEntries(reference.moments.map((m) => [m.code, { index: mean(perMoment[m.code] ?? []), n: perMoment[m.code]?.length ?? 0, weight: m.weight }])) as Record<MomentCode, { index: number | null; n: number; weight: number }>;
  const principles = reference.principles.map((p) => {
    const vals = perPrinciple.get(p.code) ?? [];
    const m = mean(vals);
    return { code: p.code, label: p.label, moment: p.moment, mean: m, n: vals.length, mastered: m == null ? null : m >= 60 };
  });
  const evaluated = principles.filter((p) => p.mean != null);
  const mastery: Partial<Record<MomentCode, number | null>> = {};
  for (const m of reference.moments) {
    const ev = evaluated.filter((p) => p.moment === m.code);
    mastery[m.code] = ev.length ? round1((ev.filter((p) => p.mastered).length / ev.length) * 100) : null;
  }
  const coverage = principles.length ? evaluated.length / principles.length : 0;
  const n = list.length;
  const enough = n >= minObservations;
  const rawIpc = weightedMoments(Object.fromEntries(Object.entries(moments).map(([k, x]) => [k, x.index])), reference);
  const rawImp = weightedMoments(mastery, reference);
  const sectors = Object.fromEntries(SECTORS.map((s) => [s.code, { index: mean(perSector[s.code] ?? []), n: perSector[s.code]?.length ?? 0 }]));
  const relations = Object.fromEntries(RELATIONS.map((s) => [s.code, { index: mean(perRelation[s.code] ?? []), n: perRelation[s.code]?.length ?? 0 }]));
  const sectorVals = Object.values(sectors).map((s) => s.index).filter((x): x is number => x != null);
  const relationVals = Object.values(relations).map((s) => s.index).filter((x): x is number => x != null);
  const checked = measures.filter((m) => m.ok != null);
  const reliability: Reliability = reliabilityOf(n, coverage, minObservations);

  return {
    observations: n,
    from: list[0]?.date ?? null,
    to: list.at(-1)?.date ?? null,
    enough,
    reliability,
    coverage: round1(coverage * 100) / 100,
    evaluatedPrinciples: evaluated.length,
    totalPrinciples: principles.length,
    /** Indices publiés seulement au-delà du seuil ; sinon null (« Données insuffisantes »). */
    ipc: enough ? rawIpc : null,
    imp: enough ? rawImp : null,
    ips: enough ? mean(sectorVals) : null,
    ipr: enough ? mean(relationVals) : null,
    raw: { ipc: rawIpc, imp: rawImp, ips: mean(sectorVals), ipr: mean(relationVals) },
    moments,
    mastery,
    principles,
    sectors,
    relations,
    timeline,
    measures,
    compactness: { checked: checked.length, inTarget: checked.filter((m) => m.ok).length },
  };
}

const pct = (from: number, to: number) => (from > 0 ? round1(((to - from) / from) * 100) : null);

function firstLast(points: { date: string; value: number | null }[]) {
  const ok = points.filter((p) => p.value != null).sort((a, b) => a.date.localeCompare(b.date)) as { date: string; value: number }[];
  return ok.length >= 2 ? { a: ok[0], b: ok.at(-1)!, n: ok.length } : null;
}

/**
 * IDC : IPC, même projet de jeu (version) et même contexte. IDS : IPS, même contexte
 * (les critères sectoriels sont fixes). Moyenne des progressions absolues.
 */
export function teamDevelopment(timeline: TeamIndices["timeline"], versionNo?: (id: string) => number | undefined) {
  const idc: Comparison[] = [];
  const ids: Comparison[] = [];
  const byKey = new Map<string, TeamIndices["timeline"]>();
  for (const t of timeline) {
    const k = `${t.versionId}|${t.context}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(t);
  }
  const ctxLabel = (c: string) => (c === "match" ? "compétition" : "entraînement");
  for (const [k, list] of byKey) {
    const fl = firstLast(list.map((t) => ({ date: t.date, value: t.ipc })));
    if (!fl) continue;
    const no = versionNo?.(list[0].versionId);
    idc.push({ kind: "evaluation", key: k, label: `IPC en ${ctxLabel(list[0].context)}${no ? ` (projet de jeu v${no})` : ""}`, n: fl.n,
      first: fl.a, last: fl.b, delta: round1(fl.b.value - fl.a.value), relative: pct(fl.a.value, fl.b.value) });
  }
  for (const c of ["match", "entrainement"] as const) {
    const fl = firstLast(timeline.filter((t) => t.context === c).map((t) => ({ date: t.date, value: t.ips })));
    if (!fl) continue;
    ids.push({ kind: "evaluation", key: `ips|${c}`, label: `IPS en ${ctxLabel(c)}`, n: fl.n, first: fl.a, last: fl.b,
      delta: round1(fl.b.value - fl.a.value), relative: pct(fl.a.value, fl.b.value) });
  }
  return { idc: mean(idc.map((x) => x.delta)), ids: mean(ids.map((x) => x.delta)), comparisons: [...idc, ...ids] };
}
