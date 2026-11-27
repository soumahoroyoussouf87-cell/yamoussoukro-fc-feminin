import type { PitchKind } from "@/lib/training/diagram";

export const SET_PIECE_CATEGORIES = ["corner_off", "corner_def", "cf_off", "cf_def", "penalty", "touche_off", "touche_def"] as const;
export type SetPieceCategory = (typeof SET_PIECE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SetPieceCategory, string> = {
  corner_off: "Corners offensifs",
  corner_def: "Corners défensifs",
  cf_off: "Coups francs offensifs",
  cf_def: "Coups francs défensifs",
  penalty: "Penalties",
  touche_off: "Touches offensives",
  touche_def: "Touches défensives",
};

/** Singulier, pour une combinaison isolée. */
export const CATEGORY_SINGULAR: Record<SetPieceCategory, string> = {
  corner_off: "Corner offensif",
  corner_def: "Corner défensif",
  cf_off: "Coup franc offensif",
  cf_def: "Coup franc défensif",
  penalty: "Penalty",
  touche_off: "Touche offensive",
  touche_def: "Touche défensive",
};

export const isDefensive = (c: SetPieceCategory) => c.endsWith("_def");

/** Terrain proposé à la création selon la catégorie. */
export const CATEGORY_PITCH: Record<SetPieceCategory, PitchKind> = {
  corner_off: "third", corner_def: "third", cf_off: "third", cf_def: "third", penalty: "box", touche_off: "half", touche_def: "half",
};

export const SIDES = ["indifferent", "gauche", "droite", "axe"] as const;
export const SIDE_LABELS: Record<(typeof SIDES)[number], string> = { indifferent: "Les deux côtés", gauche: "Côté gauche", droite: "Côté droit", axe: "Axe" };

export const TAKER_LABEL = (c: SetPieceCategory) => (isDefensive(c) ? "Premières responsables (ordre)" : c === "penalty" ? "Tireuses (ordre)" : "Tireuses / lanceuses (ordre)");
