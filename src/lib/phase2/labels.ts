/** Libellés français des énumérations de la Phase 2 (source unique pour l'interface). */
export const WORKFLOW_LABELS: Record<string, string> = {
  brouillon: "Brouillon", soumis: "Soumis", valide: "Validé", publie: "Publié", archive: "Archivé",
};
export const WORKFLOW_NEXT: Record<string, { to: string; label: string; validate: boolean }[]> = {
  brouillon: [{ to: "soumis", label: "Soumettre à validation", validate: false }, { to: "valide", label: "Valider", validate: true }],
  soumis: [{ to: "valide", label: "Valider", validate: true }, { to: "brouillon", label: "Renvoyer en brouillon", validate: false }],
  valide: [{ to: "publie", label: "Publier", validate: true }, { to: "brouillon", label: "Rouvrir (brouillon)", validate: true }],
  publie: [{ to: "archive", label: "Archiver", validate: true }, { to: "brouillon", label: "Rouvrir (brouillon)", validate: true }],
  archive: [{ to: "brouillon", label: "Rouvrir (brouillon)", validate: true }],
};
export function workflowVariant(s: string): "outline" | "warning" | "success" | "default" | "secondary" {
  return s === "brouillon" ? "outline" : s === "soumis" ? "warning" : s === "valide" ? "success" : s === "publie" ? "default" : "secondary";
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  seance_video: "Séance vidéo", test_physique: "Tests physiques", reunion: "Réunion", deplacement: "Déplacement",
  stage: "Stage", repos: "Repos", recuperation: "Récupération", soins: "Soins", autre: "Autre",
};
export const INTENSITY_LABELS: Record<string, string> = {
  repos: "Repos", faible: "Faible", moderee: "Modérée", elevee: "Élevée", maximale: "Maximale",
};
export const BLOCK_LABELS: Record<string, string> = {
  activation: "Activation", echauffement: "Échauffement", mise_en_train: "Mise en train",
  situation_apprentissage: "Situation d'apprentissage", exercice_technique: "Exercice technique",
  exercice_tactique: "Exercice tactique", jeu_dirige: "Jeu dirigé", jeu_application: "Jeu d'application",
  retour_au_calme: "Retour au calme",
};
export const CATEGORY_LABELS: Record<string, string> = {
  technique_offensive: "Technique offensive", technique_defensive: "Technique défensive",
  tactique_offensive: "Tactique offensive", tactique_defensive: "Tactique défensive",
  transition_offensive: "Transition offensive", transition_defensive: "Transition défensive",
  pressing: "Pressing", cpa: "Coups de pied arrêtés", gardiennes: "Gardiennes", endurance: "Endurance",
  vitesse: "Vitesse", coordination: "Coordination", developpement_individuel: "Développement individuel",
  developpement_sectoriel: "Développement sectoriel", developpement_collectif: "Développement collectif",
};
export const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présente", retard: "En retard", absente_justifiee: "Absente (justifiée)",
  absente_non_justifiee: "Absente (non justifiée)", blessee: "Blessée", dispensee: "Dispensée",
};
export const SQUAD_STATUS_LABELS: Record<string, string> = {
  convoquee: "Convoquée", reserviste: "Réserviste", non_retenue: "Non retenue",
};
export const LINEUP_STATUS_LABELS: Record<string, string> = {
  provisoire: "Provisoire — confidentielle", validee: "Validée (officielle)", communiquee: "Communiquée",
};
export const MATCH_STATUS_LABELS: Record<string, string> = {
  programme: "Programmé", joue: "Joué", reporte: "Reporté", annule: "Annulé",
};
export const HOME_AWAY_LABELS: Record<string, string> = { domicile: "Domicile", exterieur: "Extérieur", neutre: "Terrain neutre" };
export const PERIOD_LABELS: Record<string, string> = { "1MT": "1re mi-temps", "2MT": "2e mi-temps", PROL1: "Prolongation 1", PROL2: "Prolongation 2", TAB: "Tirs au but" };
export const MATCH_EVENT_LABELS: Record<string, string> = {
  but: "But", but_adverse: "But adverse", csc_pour: "But contre son camp (adverse)", csc_contre: "But contre son camp (YFC)",
  penalty_manque: "Penalty manqué", carton_jaune: "Carton jaune", carton_rouge: "Carton rouge",
  remplacement: "Remplacement", changement_tactique: "Changement tactique", blessure: "Blessure", observation: "Observation",
};
export const DELEGATION_GROUP_LABELS: Record<string, string> = {
  joueuse: "Joueuses", staff_technique: "Staff technique", staff_performance: "Staff performance",
  staff_medical: "Staff médical", administration: "Administration", communication: "Communication",
  logistique: "Logistique", autre: "Autres",
};

const fmtLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fmtShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const fmtDayAbidjan = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan" });

export const isoToUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const dayLong = (iso: string) => fmtLong.format(isoToUtc(iso));
export const dayShort = (iso: string) => fmtShort.format(isoToUtc(iso));
export const monthLabel = (iso: string) => fmtMonth.format(isoToUtc(iso));
/** Heure locale (Abidjan) d'un horodatage. */
export const timeOf = (ts: string) => fmtTime.format(new Date(ts));
/** Jour local (Abidjan, AAAA-MM-JJ) d'un horodatage. */
export const dayOf = (ts: string) => fmtDayAbidjan.format(new Date(ts));
/** « 18:30:00 » → « 18h30 ». */
export const hm = (t?: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "");
/** Aujourd'hui à Abidjan (AAAA-MM-JJ). */
export const todayIso = () => fmtDayAbidjan.format(new Date());
