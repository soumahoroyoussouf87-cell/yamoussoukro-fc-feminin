/**
 * Moteur de calcul du Performance Framework (cahier des charges §19, §28).
 * Fonctions pures, sans accès réseau : testées dans tests/unit/performance-engine.test.ts.
 *
 * Règles :
 * - Note 1-5 convertie sur 100 (×20). N/E (null) exclu du numérateur ET du dénominateur.
 * - Indice d'une dimension = Σ(note/100 × pondération) ÷ Σ(pondérations des critères évalués).
 * - Technique : sources Tests 20 % · Entraînement 30 % · Compétition 50 %, renormalisées sur les sources présentes.
 * - IPI = Σ(indice dimension × pondération du poste) ÷ Σ(pondérations des dimensions évaluées).
 * - IPI publié seulement au-delà du seuil d'observations ; sinon « Données insuffisantes ».
 */

export const DIMENSIONS = [
  { code: "technique", label: "Technique" },
  { code: "tactique", label: "Tactique" },
  { code: "athletique", label: "Athlétique" },
  { code: "cognitive", label: "Cognitive" },
  { code: "mentale", label: "Mentale" },
  { code: "comportementale", label: "Comportementale" },
] as const;
export type DimensionCode = (typeof DIMENSIONS)[number]["code"];
export const DIMENSION_CODES = DIMENSIONS.map((d) => d.code) as DimensionCode[];
export const DIMENSION_LABELS = Object.fromEntries(DIMENSIONS.map((d) => [d.code, d.label])) as Record<DimensionCode, string>;

export const FRAMEWORK_KEYS = ["GB", "DC", "DD_DG", "N6", "N8", "N10", "AILIERE", "N9", "PISTON"] as const;
export type FrameworkKey = (typeof FRAMEWORK_KEYS)[number];
export const FRAMEWORK_KEY_LABELS: Record<FrameworkKey, string> = {
  GB: "Gardienne", DC: "Défenseure centrale", DD_DG: "Latérale", N6: "Sentinelle — N°6", N8: "Relayeuse — N°8",
  N10: "Milieu offensive — N°10", AILIERE: "Ailière", N9: "Attaquante — N°9", PISTON: "Piston",
};

export const SCALE = [
  { score: 1, index: 20, label: "Insuffisant" },
  { score: 2, index: 40, label: "En acquisition" },
  { score: 3, index: 60, label: "Acquis" },
  { score: 4, index: 80, label: "Maîtrisé" },
  { score: 5, index: 100, label: "Maîtrise supérieure" },
] as const;

export type Context = "match" | "entrainement" | "test";
export const CONTEXT_LABELS: Record<Context, string> = { match: "Compétition", entrainement: "Entraînement", test: "Tests techniques" };
/** Sources de l'évaluation technique (§28), en %. */
export const TECH_SOURCE_WEIGHTS: Record<Context, number> = { test: 20, entrainement: 30, match: 50 };

export type Reliability = "insuffisante" | "faible" | "moyenne" | "elevee";
export const RELIABILITY_LABELS: Record<Reliability, string> = {
  insuffisante: "Données insuffisantes", faible: "Fiabilité faible", moyenne: "Fiabilité moyenne", elevee: "Fiabilité élevée",
};

export type Criterion = { id: string; code: string; label: string; description?: string | null; dimension: DimensionCode; defaultWeight: number | null; sortOrder?: number };
export type VersionModel = {
  id: string;
  versionNo: number;
  label: string;
  criteria: Criterion[];
  /** Pondérations explicites : criterionId → poste → poids. */
  criterionWeights: Record<string, Partial<Record<FrameworkKey, number>>>;
  /** Pondérations des dimensions par poste (en %). */
  dimensionWeights: Partial<Record<FrameworkKey, Partial<Record<DimensionCode, number>>>>;
};

export type Score = { criterionId: string; score: number | null };
export type Observation = {
  id: string;
  date: string; // AAAA-MM-JJ
  context: Context;
  versionId: string;
  frameworkKey: FrameworkKey;
  scores: Score[];
};

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreToIndex(score: number | null | undefined): number | null {
  if (score == null || !Number.isInteger(score) || score < 1 || score > 5) return null;
  return score * 20;
}

export function levelOf(index: number | null): string {
  if (index == null) return "Non évalué";
  if (index < 30) return "Insuffisant";
  if (index < 50) return "En acquisition";
  if (index < 70) return "Acquis";
  if (index < 90) return "Maîtrisé";
  return "Maîtrise supérieure";
}

/** Poids d'un critère pour un poste ; null = critère non applicable à ce poste. */
export function criterionWeight(v: VersionModel, c: Criterion, fk: FrameworkKey): number | null {
  const explicit = v.criterionWeights[c.id];
  if (explicit && explicit[fk] !== undefined) return explicit[fk]! > 0 ? explicit[fk]! : null;
  if (c.defaultWeight != null && c.defaultWeight > 0) return c.defaultWeight;
  return null;
}

/** Critères applicables à un poste (poids > 0), dans l'ordre d'affichage. */
export function applicableCriteria(v: VersionModel, fk: FrameworkKey, dim?: DimensionCode): Criterion[] {
  return v.criteria
    .filter((c) => (!dim || c.dimension === dim) && criterionWeight(v, c, fk) != null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export type DimResult = { index: number | null; evaluated: number; applicable: number };

/** Indices par dimension d'une seule évaluation. */
export function evaluationDimensions(v: VersionModel, fk: FrameworkKey, scores: Score[]): Record<DimensionCode, DimResult> {
  const byId = new Map(scores.map((s) => [s.criterionId, s.score]));
  const out = {} as Record<DimensionCode, DimResult>;
  for (const dim of DIMENSION_CODES) {
    let num = 0;
    let den = 0;
    let evaluated = 0;
    const list = applicableCriteria(v, fk, dim);
    for (const c of list) {
      const idx = scoreToIndex(byId.get(c.id));
      if (idx == null) continue; // N/E : ni numérateur ni dénominateur
      const w = criterionWeight(v, c, fk)!;
      num += idx * w;
      den += w;
      evaluated++;
    }
    out[dim] = { index: den > 0 ? round1(num / den) : null, evaluated, applicable: list.length };
  }
  return out;
}

/** Combine des indices par dimension avec les pondérations du poste (dimensions évaluées seulement). */
export function weightedIndex(dims: Partial<Record<DimensionCode, number | null>>, weights: Partial<Record<DimensionCode, number>> | undefined): number | null {
  if (!weights) return null;
  let num = 0;
  let den = 0;
  for (const dim of DIMENSION_CODES) {
    const v = dims[dim];
    const w = weights[dim] ?? 0;
    if (v == null || w <= 0) continue;
    num += v * w;
    den += w;
  }
  return den > 0 ? round1(num / den) : null;
}

export function mean(values: number[]): number | null {
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Sources techniques : moyenne par source puis pondération 20/30/50 renormalisée. */
export function combineSources(perSource: Partial<Record<Context, number[]>>) {
  let num = 0;
  let den = 0;
  const sources: { context: Context; index: number; n: number; weight: number }[] = [];
  for (const ctx of ["test", "entrainement", "match"] as Context[]) {
    const vals = perSource[ctx] ?? [];
    const m = mean(vals);
    if (m == null) continue;
    sources.push({ context: ctx, index: m, n: vals.length, weight: TECH_SOURCE_WEIGHTS[ctx] });
    num += m * TECH_SOURCE_WEIGHTS[ctx];
    den += TECH_SOURCE_WEIGHTS[ctx];
  }
  return {
    index: den > 0 ? round1(num / den) : null,
    sources: sources.map((s) => ({ ...s, effectiveWeight: round1((s.weight / den) * 100) })),
    renormalized: sources.length > 0 && sources.length < 3,
  };
}

export function modeKey(obs: Observation[]): FrameworkKey | null {
  const count = new Map<FrameworkKey, { n: number; last: string }>();
  for (const o of obs) {
    const c = count.get(o.frameworkKey) ?? { n: 0, last: "" };
    count.set(o.frameworkKey, { n: c.n + 1, last: o.date > c.last ? o.date : c.last });
  }
  let best: FrameworkKey | null = null;
  let bestN = -1;
  let bestLast = "";
  for (const [k, c] of count) {
    if (c.n > bestN || (c.n === bestN && c.last > bestLast)) {
      best = k;
      bestN = c.n;
      bestLast = c.last;
    }
  }
  return best;
}

export function reliabilityOf(n: number, coverage: number, minObservations: number): Reliability {
  if (n < minObservations) return "insuffisante";
  if (coverage < 0.5) return "faible";
  if (n < 2 * minObservations || coverage < 0.75) return "moyenne";
  return "elevee";
}

export type PlayerIndices = {
  observations: number;
  from: string | null;
  to: string | null;
  frameworkKey: FrameworkKey | null;
  dims: Record<DimensionCode, { index: number | null; n: number }>;
  technicalSources: ReturnType<typeof combineSources>["sources"];
  technicalRenormalized: boolean;
  /** IPI publié (null si non évalué ou sous le seuil). */
  ipi: number | null;
  ipiStatus: "publie" | "insuffisant" | "non_evalue";
  coverage: number;
  evaluatedCriteria: number;
  applicableCriteria: number;
  reliability: Reliability;
  /** Indice de chaque évaluation, dans l'ordre chronologique (courbe de progression). */
  timeline: { id: string; date: string; context: Context; ipi: number | null; dims: Record<DimensionCode, number | null> }[];
  /** Moyenne par critère (code) sur la période. */
  criteria: Record<string, { mean: number; n: number }>;
};

/**
 * Agrège les évaluations validées d'une joueuse sur une période.
 * `reference` = version publiée actuelle (pondérations des dimensions et couverture).
 */
export function aggregatePlayer(observations: Observation[], versions: Map<string, VersionModel>, reference: VersionModel, minObservations: number): PlayerIndices {
  const obs = observations.filter((o) => versions.has(o.versionId)).sort((a, b) => a.date.localeCompare(b.date));
  const fk = modeKey(obs);
  const perDim: Record<DimensionCode, number[]> = Object.fromEntries(DIMENSION_CODES.map((d) => [d, []])) as never;
  const techBySource: Partial<Record<Context, number[]>> = {};
  const timeline: PlayerIndices["timeline"] = [];
  const crit = new Map<string, number[]>();

  for (const o of obs) {
    const v = versions.get(o.versionId)!;
    const dims = evaluationDimensions(v, o.frameworkKey, o.scores);
    const flat = {} as Record<DimensionCode, number | null>;
    for (const d of DIMENSION_CODES) {
      flat[d] = dims[d].index;
      if (dims[d].index == null) continue;
      if (d === "technique") (techBySource[o.context] ??= []).push(dims[d].index!);
      else perDim[d].push(dims[d].index!);
    }
    timeline.push({ id: o.id, date: o.date, context: o.context, ipi: weightedIndex(flat, v.dimensionWeights[o.frameworkKey]), dims: flat });
    const byId = new Map(v.criteria.map((c) => [c.id, c]));
    for (const s of o.scores) {
      const idx = scoreToIndex(s.score);
      const c = byId.get(s.criterionId);
      if (idx == null || !c || criterionWeight(v, c, o.frameworkKey) == null) continue;
      const list = crit.get(c.code) ?? [];
      list.push(idx);
      crit.set(c.code, list);
    }
  }

  const tech = combineSources(techBySource);
  const dims = {} as PlayerIndices["dims"];
  for (const d of DIMENSION_CODES) {
    if (d === "technique") dims[d] = { index: tech.index, n: Object.values(techBySource).reduce((a, l) => a + (l?.length ?? 0), 0) };
    else dims[d] = { index: mean(perDim[d]), n: perDim[d].length };
  }

  const applicable = fk ? applicableCriteria(reference, fk) : [];
  const applicableCodes = new Set(applicable.map((c) => c.code));
  const evaluated = [...crit.keys()].filter((code) => applicableCodes.has(code)).length;
  const coverage = applicable.length ? evaluated / applicable.length : 0;
  const raw = fk ? weightedIndex(Object.fromEntries(DIMENSION_CODES.map((d) => [d, dims[d].index])), reference.dimensionWeights[fk]) : null;
  const reliability = reliabilityOf(obs.length, coverage, minObservations);
  const ipiStatus = raw == null ? "non_evalue" : obs.length < minObservations ? "insuffisant" : "publie";

  return {
    observations: obs.length,
    from: obs[0]?.date ?? null,
    to: obs.at(-1)?.date ?? null,
    frameworkKey: fk,
    dims,
    technicalSources: tech.sources,
    technicalRenormalized: tech.renormalized,
    ipi: ipiStatus === "publie" ? raw : null,
    ipiStatus,
    coverage: round1(coverage * 100) / 100,
    evaluatedCriteria: evaluated,
    applicableCriteria: applicable.length,
    reliability,
    timeline,
    criteria: Object.fromEntries([...crit].map(([code, l]) => [code, { mean: mean(l)!, n: l.length }])),
  };
}

/** Indices d'équipe par dimension : moyenne des joueuses ayant atteint le seuil (jamais l'IPC collectif). */
export function teamDimensionIndices(players: PlayerIndices[], minObservations: number) {
  const eligible = players.filter((p) => p.observations >= minObservations);
  const out = {} as Record<DimensionCode, { index: number | null; players: number }>;
  for (const d of DIMENSION_CODES) {
    const vals = eligible.map((p) => p.dims[d].index).filter((x): x is number => x != null);
    out[d] = { index: mean(vals), players: vals.length };
  }
  const ipis = eligible.map((p) => p.ipi).filter((x): x is number => x != null);
  return { dims: out, ipi: mean(ipis), players: eligible.length };
}

/** Poste (code) → ligne du référentiel (positions.framework_key). */
export const POSITION_FRAMEWORK_KEY: Record<string, FrameworkKey> = {
  GB: "GB", DC: "DC", DD: "DD_DG", DG: "DD_DG", PD: "PISTON", PG: "PISTON", N6: "N6", N8: "N8", N10: "N10", AD: "AILIERE", AG: "AILIERE", N9: "N9",
};
