export const SCOPES = ["individuel", "sectoriel", "collectif"] as const;
export type Scope = (typeof SCOPES)[number];
export const SCOPE_LABELS: Record<Scope, string> = { individuel: "Individuel", sectoriel: "Sectoriel", collectif: "Collectif" };
export const SCOPE_PLURAL: Record<Scope, string> = { individuel: "Plans individuels", sectoriel: "Plans sectoriels", collectif: "Plans collectifs" };

export const PLAN_STATUSES = ["actif", "termine", "abandonne"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = { actif: "En cours", termine: "Terminé", abandonne: "Abandonné" };

export const OBJ_STATUSES = ["en_cours", "atteint", "partiel", "non_atteint", "abandonne"] as const;
export type ObjStatus = (typeof OBJ_STATUSES)[number];
export const OBJ_STATUS_LABELS: Record<ObjStatus, string> = {
  en_cours: "En cours", atteint: "Atteint", partiel: "Partiellement atteint", non_atteint: "Non atteint", abandonne: "Abandonné",
};
export const OBJ_STATUS_VARIANT: Record<ObjStatus, "outline" | "success" | "warning" | "danger"> = {
  en_cours: "outline", atteint: "success", partiel: "warning", non_atteint: "danger", abandonne: "outline",
};

export const OBJ_DIMENSIONS = ["technique", "tactique", "athletique", "cognitive", "mentale", "comportementale", "collectif"] as const;
export type ObjDimension = (typeof OBJ_DIMENSIONS)[number];
export const OBJ_DIMENSION_LABELS: Record<ObjDimension, string> = {
  technique: "Technique", tactique: "Tactique", athletique: "Athlétique", cognitive: "Cognitive", mentale: "Mentale",
  comportementale: "Comportementale", collectif: "Collectif",
};

export const PRIORITIES = ["basse", "normale", "haute"] as const;
export const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = { basse: "Basse", normale: "Normale", haute: "Haute" };

export const DECISIONS = ["poursuivre", "ajuster", "prolonger", "cloturer"] as const;
export type Decision = (typeof DECISIONS)[number];
export const DECISION_LABELS: Record<Decision, string> = {
  poursuivre: "Poursuivre le plan", ajuster: "Ajuster les objectifs", prolonger: "Prolonger le plan", cloturer: "Clôturer le plan",
};
