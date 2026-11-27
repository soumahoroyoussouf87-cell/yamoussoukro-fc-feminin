/** Libellés des fiches d'observation (partagés entre l'éditeur et les rapports imprimables). */
export const SOURCE_LABELS: Record<string, string> = { video: "Vidéo", direct: "Observation en direct", rapport: "Rapport d'un tiers", statistiques: "Statistiques", autre: "Autre" };
export const FACT_FIELDS = [
  { key: "in_possession", label: "En possession", hint: "Construction, circuits préférentiels, joueuses qui décrochent…" },
  { key: "out_possession", label: "Hors possession", hint: "Hauteur du bloc, déclencheurs du pressing, orientation…" },
  { key: "transitions", label: "Transitions", hint: "Réaction à la perte, vitesse de projection…" },
  { key: "set_pieces", label: "Coups de pied arrêtés", hint: "Tireuses, schémas, marquage (zone, individuel)…" },
  { key: "key_players", label: "Joueuses clés", hint: "Numéro, poste, profil observé." },
] as const;
export const READING_FIELDS = [
  { key: "strengths", label: "Forces" },
  { key: "weaknesses", label: "Faiblesses" },
  { key: "interpretation", label: "Interprétation du staff" },
  { key: "game_plan", label: "Plan de jeu proposé" },
] as const;
