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
  timeline: { id: string; date: string; context: Context; versionId: string; frameworkKey: FrameworkKey; ipi: number | null; dims: Record<DimensionCode, number | null> }[];
  /** Séances de tests validées prises en compte (source « Tests » de la technique). */
  testSessions: number;
  /** Moyenne par critère (code) sur la période. */
  criteria: Record<string, { mean: number; n: number }>;
};

/**
 * Agrège les évaluations validées d'une joueuse sur une période.
 * `reference` = version publiée actuelle (pondérations des dimensions et couverture).
 */
export function aggregatePlayer(
  observations: Observation[], versions: Map<string, VersionModel>, reference: VersionModel, minObservations: number,
  opts: { tests?: TestSession[]; fallbackKey?: FrameworkKey | null } = {},
): PlayerIndices {
  const obs = observations.filter((o) => versions.has(o.versionId)).sort((a, b) => a.date.localeCompare(b.date));
  const fk = modeKey(obs) ?? opts.fallbackKey ?? null;
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
    timeline.push({ id: o.id, date: o.date, context: o.context, versionId: o.versionId, frameworkKey: o.frameworkKey, ipi: weightedIndex(flat, v.dimensionWeights[o.frameworkKey]), dims: flat });
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

  let testSessions = 0;
  if (fk) {
    for (const t of opts.tests ?? []) {
      const idx = testTechniqueIndex(reference, fk, t.results);
      if (idx == null) continue;
      (techBySource.test ??= []).push(idx);
      testSessions++;
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
    testSessions,
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

// ----------------------------------------------------------------- Tests techniques (§21)

export const MEASURE_LABELS = { reussite: "Réussites / tentatives", temps: "Temps (secondes)" } as const;
export type Measure = keyof typeof MEASURE_LABELS;

/** Indice 0-100 d'un résultat (même formule que la base, pour l'aperçu pendant la saisie). */
export function testResultIndex(r: { measure: Measure; attempts?: number | null; successes?: number | null; valueSeconds?: number | null; refBest?: number | null; refLimit?: number | null }): number | null {
  if (r.measure === "reussite") {
    if (!r.attempts || r.attempts <= 0 || r.successes == null || r.successes < 0 || r.successes > r.attempts) return null;
    return round1((r.successes * 100) / r.attempts);
  }
  if (r.valueSeconds == null || r.valueSeconds <= 0 || r.refBest == null || r.refLimit == null || r.refBest >= r.refLimit) return null;
  return round1(Math.max(0, Math.min(1, (r.refLimit - r.valueSeconds) / (r.refLimit - r.refBest))) * 100);
}

export type TestSession = { id: string; date: string; results: { criterionCodes: string[]; index: number | null }[] };

/**
 * Indice technique d'une séance de tests pour un poste : chaque protocole renseigne les critères
 * techniques qu'il mesure ; on pondère avec les poids du poste. Les critères non mesurés ou non
 * applicables au poste sont ignorés (jamais pénalisés).
 */
export function testTechniqueIndex(v: VersionModel, fk: FrameworkKey, results: TestSession["results"]): number | null {
  const perCode = new Map<string, number[]>();
  for (const r of results) {
    if (r.index == null) continue;
    for (const code of r.criterionCodes) (perCode.get(code) ?? perCode.set(code, []).get(code)!).push(r.index);
  }
  let num = 0;
  let den = 0;
  for (const c of v.criteria) {
    if (c.dimension !== "technique") continue;
    const vals = perCode.get(c.code);
    const w = criterionWeight(v, c, fk);
    if (!vals?.length || w == null) continue;
    num += mean(vals)! * w;
    den += w;
  }
  return den > 0 ? round1(num / den) : null;
}

export type TestPoint = {
  protocolId: string; protocolName: string; protocolVersion: number; measure: Measure;
  date: string; index: number | null; raw: number | null;
};

export type Comparison = {
  kind: "test" | "evaluation";
  key: string;
  label: string;
  first: { date: string; value: number };
  last: { date: string; value: number };
  n: number;
  /** Progression absolue, en points d'indice. */
  delta: number;
  /** Progression relative, en % de la valeur de départ. */
  relative: number | null;
  /** Écart brut quand l'indice n'est pas calculable (test chronométré sans barème), en secondes. */
  rawDelta?: number;
};

const pct = (from: number, to: number) => (from > 0 ? round1(((to - from) / from) * 100) : null);

/**
 * IDI (§29) : ne compare que des mesures comparables — même protocole ET même version pour les tests,
 * même référentiel, même poste et même contexte pour les évaluations. Première et dernière mesure de la période.
 * IDI = moyenne des progressions absolues (points) ; la progression relative moyenne est affichée à côté.
 */
export function developmentIndex(input: {
  tests: TestPoint[];
  timeline: Pick<PlayerIndices["timeline"][number], "date" | "context" | "versionId" | "frameworkKey" | "ipi">[];
  versionNo?: (versionId: string) => number | undefined;
}) {
  const comparisons: Comparison[] = [];
  const pending: Comparison[] = [];

  const groups = new Map<string, TestPoint[]>();
  for (const t of input.tests) {
    const k = `${t.protocolId}|${t.protocolVersion}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  for (const [k, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const label = `${sorted[0].protocolName}${sorted[0].protocolVersion > 1 ? ` (protocole v${sorted[0].protocolVersion})` : ""}`;
    const withIndex = sorted.filter((t) => t.index != null);
    if (withIndex.length >= 2) {
      const a = withIndex[0];
      const b = withIndex.at(-1)!;
      comparisons.push({
        kind: "test", key: k, label, n: withIndex.length,
        first: { date: a.date, value: a.index! }, last: { date: b.date, value: b.index! },
        delta: round1(b.index! - a.index!), relative: pct(a.index!, b.index!),
      });
      continue;
    }
    const withRaw = sorted.filter((t) => t.raw != null);
    if (sorted[0].measure === "temps" && withRaw.length >= 2) {
      const a = withRaw[0];
      const b = withRaw.at(-1)!;
      pending.push({
        kind: "test", key: k, label, n: withRaw.length,
        first: { date: a.date, value: a.raw! }, last: { date: b.date, value: b.raw! },
        delta: 0, relative: null, rawDelta: round1(b.raw! - a.raw!),
      });
    }
  }

  const evals = new Map<string, typeof input.timeline>();
  for (const t of input.timeline) {
    if (t.ipi == null) continue;
    const k = `${t.versionId}|${t.frameworkKey}|${t.context}`;
    (evals.get(k) ?? evals.set(k, []).get(k)!).push(t);
  }
  for (const [k, list] of evals) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const a = sorted[0];
    const b = sorted.at(-1)!;
    const no = input.versionNo?.(a.versionId);
    comparisons.push({
      kind: "evaluation", key: k,
      label: `Évaluations ${CONTEXT_LABELS[a.context].toLowerCase()} · ${FRAMEWORK_KEY_LABELS[a.frameworkKey]}${no ? ` (référentiel v${no})` : ""}`,
      n: sorted.length, first: { date: a.date, value: a.ipi! }, last: { date: b.date, value: b.ipi! },
      delta: round1(b.ipi! - a.ipi!), relative: pct(a.ipi!, b.ipi!),
    });
  }

  const rel = comparisons.map((c) => c.relative).filter((x): x is number => x != null);
  return {
    idi: mean(comparisons.map((c) => c.delta)),
    relative: mean(rel),
    comparisons: comparisons.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)),
    /** Tests chronométrés comparables sans barème : écart en secondes, hors IDI. */
    rawOnly: pending,
  };
}

/** « +4,5 pts » / « −2 pts » / « 0 pt ». */
export function fmtDelta(n: number | null, unit = "pts"): string {
  if (n == null) return "—";
  const v = String(Math.abs(n)).replace(".", ",");
  if (n === 0) return `0 ${unit === "pts" ? "pt" : unit}`;
  return `${n > 0 ? "+" : "−"}${v} ${unit}`;
}
