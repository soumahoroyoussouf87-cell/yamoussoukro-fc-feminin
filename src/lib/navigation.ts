import {
  Activity, BarChart3, Bell, Bot, BookOpen, Brain, Calendar, CalendarDays, CalendarRange, ClipboardCheck,
  ClipboardList, Clapperboard, Database, Dumbbell, FileText, Flag, FolderLock, Gauge, Goal, HeartPulse,
  KeyRound, LayoutDashboard, LayoutTemplate, PenTool, Tags, ListChecks, ListTodo, type LucideIcon, Map, Medal, MonitorPlay, Network,
  PlaySquare, Repeat, ScrollText, Settings, Shield, ShieldCheck, Shirt, Sparkles, Stethoscope, Swords,
  Target, Timer, Trophy, UserCheck, UserCog, Users, Video,
} from "lucide-react";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Présent uniquement si l'écran est réellement opérationnel. */
  href?: string;
  /** Phase de la roadmap qui livre l'écran. */
  phase: number;
  /** Permission requise pour afficher l'entrée (si opérationnelle). */
  permission?: string;
};

export type NavSection = { title: string; items: NavItem[] };

export const NAVIGATION: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Tableau de bord", icon: LayoutDashboard, href: "/tableau-de-bord", phase: 1, permission: "dashboard.read" },
      { label: "Agenda", icon: Calendar, href: "/planification/calendrier", phase: 2, permission: "planning.read" },
      { label: "Notifications", icon: Bell, href: "/notifications", phase: 1 },
      { label: "Tâches du staff", icon: ListTodo, href: "/taches", phase: 3 },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Effectif", icon: Users, href: "/effectif", phase: 1, permission: "players.read" },
      { label: "Staff technique", icon: UserCog, href: "/staff", phase: 1, permission: "staff.read" },
      { label: "Disponibilité des joueuses", icon: UserCheck, href: "/disponibilites", phase: 1, permission: "availability.read" },
      { label: "Documents administratifs", icon: FolderLock, href: "/documents", phase: 1, permission: "players.documents.read" },
    ],
  },
  {
    title: "Planification",
    items: [
      { label: "Calendrier de la saison", icon: CalendarRange, href: "/planification/calendrier?vue=mois", phase: 2, permission: "planning.read" },
      { label: "Macrocycles", icon: Repeat, href: "/planification/cycles#macro", phase: 2, permission: "planning.read" },
      { label: "Mésocycles", icon: Repeat, href: "/planification/cycles#meso", phase: 2, permission: "planning.read" },
      { label: "Microcycles", icon: Repeat, href: "/planification/microcycles", phase: 2, permission: "planning.read" },
      { label: "Programme hebdomadaire", icon: CalendarDays, href: "/planification/programme", phase: 2, permission: "planning.read" },
    ],
  },
  {
    title: "Entraînement",
    items: [
      { label: "Tableau de bord", icon: LayoutDashboard, href: "/entrainement", phase: 2, permission: "planning.read" },
      { label: "Fiches de séance", icon: ClipboardList, href: "/entrainement/seances", phase: 2, permission: "planning.read" },
      { label: "Bibliothèque d'exercices", icon: BookOpen, href: "/entrainement/exercices", phase: 2, permission: "planning.read" },
      { label: "Schémas tactiques", icon: PenTool, href: "/entrainement/schemas", phase: 2, permission: "planning.read" },
      { label: "Thèmes", icon: Tags, href: "/entrainement/themes", phase: 2, permission: "planning.read" },
      { label: "Modèles de séance", icon: LayoutTemplate, href: "/entrainement/modeles", phase: 2, permission: "planning.read" },
      { label: "Présences", icon: ListChecks, href: "/entrainement/presences", phase: 2, permission: "planning.read" },
      { label: "Évaluation des séances", icon: ClipboardCheck, href: "/entrainement/evaluations", phase: 2, permission: "planning.read" },
      { label: "Séances vidéo", icon: MonitorPlay, phase: 4 },
    ],
  },
  {
    title: "Compétition",
    items: [
      { label: "Calendrier des rencontres", icon: CalendarDays, href: "/competition/rencontres", phase: 2, permission: "matches.read" },
      { label: "Match Center", icon: Trophy, href: "/competition/match-center", phase: 2, permission: "matches.read" },
      { label: "Convocations", icon: FileText, href: "/competition/convocations", phase: 2, permission: "matches.read" },
      { label: "Onze de départ", icon: Shirt, href: "/competition/onze-de-depart", phase: 2, permission: "matches.read" },
      { label: "Délégations", icon: Users, href: "/competition/delegations", phase: 2, permission: "matches.read" },
      { label: "Résultats", icon: Flag, href: "/competition/resultats", phase: 2, permission: "matches.read" },
      { label: "Classement", icon: Medal, href: "/competition/classement", phase: 2, permission: "matches.read" },
      { label: "Statistiques", icon: BarChart3, href: "/competition/statistiques", phase: 2, permission: "matches.read" },
    ],
  },
  {
    title: "Tactique",
    items: [
      { label: "Projet de jeu", icon: Shield, href: "/projet-de-jeu", phase: 3, permission: "evaluations.read" },
      { label: "Systèmes de jeu", icon: Network, href: "/projet-de-jeu/systemes", phase: 3, permission: "evaluations.read" },
      { label: "Tableau tactique", icon: Map, href: "/entrainement/schemas/nouveau", phase: 3, permission: "planning.write" },
      { label: "Principes et sous-principes", icon: ScrollText, href: "/projet-de-jeu", phase: 3, permission: "evaluations.read" },
      { label: "Analyse des adversaires", icon: Swords, href: "/tactique/adversaires", phase: 3, permission: "evaluations.read" },
      { label: "Coups de pied arrêtés", icon: Flag, href: "/tactique/cpa", phase: 3, permission: "evaluations.read" },
    ],
  },
  {
    title: "Performance",
    items: [
      { label: "Performance individuelle", icon: Gauge, href: "/performance/individuelle", phase: 3, permission: "evaluations.read" },
      { label: "Évaluations", icon: ClipboardCheck, href: "/performance/evaluations", phase: 3, permission: "evaluations.read" },
      { label: "Performance sectorielle", icon: Gauge, href: "/performance/collective#secteurs", phase: 3, permission: "evaluations.read" },
      { label: "Performance intersectorielle", icon: Network, href: "/performance/collective#relations", phase: 3, permission: "evaluations.read" },
      { label: "Performance collective", icon: Users, href: "/performance/collective", phase: 3, permission: "evaluations.read" },
      { label: "Tests techniques", icon: Timer, href: "/performance/tests", phase: 3, permission: "evaluations.read" },
      { label: "Référentiels d'évaluation", icon: ScrollText, href: "/performance/referentiels", phase: 3, permission: "evaluations.read" },
    ],
  },
  {
    title: "Analyse vidéo",
    items: [
      { label: "Vidéothèque individuelle", icon: Video, phase: 4 },
      { label: "Vidéothèque sectorielle", icon: Video, phase: 4 },
      { label: "Vidéothèque collective", icon: Video, phase: 4 },
      { label: "Vidéothèque des entraînements", icon: Video, phase: 4 },
      { label: "Analyse adverse", icon: Swords, phase: 4 },
      { label: "Codification", icon: Clapperboard, phase: 4 },
      { label: "Playlists", icon: PlaySquare, phase: 4 },
      { label: "Comparaison vidéo", icon: MonitorPlay, phase: 4 },
      { label: "Bibliothèque tactique", icon: BookOpen, phase: 4 },
    ],
  },
  {
    title: "Développement",
    items: [
      { label: "Plans individuels", icon: Target, href: "/developpement?portee=individuel", phase: 4, permission: "development.read" },
      { label: "Plans sectoriels", icon: Target, href: "/developpement?portee=sectoriel", phase: 4, permission: "development.read" },
      { label: "Plans collectifs", icon: Target, href: "/developpement?portee=collectif", phase: 4, permission: "development.read" },
      { label: "Objectifs", icon: Goal, href: "/developpement/objectifs", phase: 4, permission: "development.read" },
      { label: "Exercices correctifs", icon: Dumbbell, href: "/developpement/exercices", phase: 4, permission: "development.read" },
      { label: "Réévaluations", icon: Repeat, href: "/developpement/reevaluations", phase: 4, permission: "development.read" },
    ],
  },
  {
    title: "Sport science",
    items: [
      { label: "Tests physiques", icon: Timer, phase: 5 },
      { label: "Données GPS", icon: Activity, phase: 5 },
      { label: "Charges d'entraînement", icon: Dumbbell, phase: 5 },
      { label: "Récupération", icon: HeartPulse, phase: 5 },
      { label: "Disponibilité médicale", icon: Stethoscope, phase: 5 },
    ],
  },
  {
    title: "Intelligence artificielle",
    items: [
      { label: "Assistant du staff", icon: Bot, phase: 6 },
      { label: "Analyse des performances", icon: Brain, phase: 6 },
      { label: "Recommandations", icon: Sparkles, phase: 6 },
      { label: "Rapports intelligents", icon: FileText, phase: 6 },
    ],
  },
  {
    title: "Rapports",
    items: [
      { label: "Rapports individuels", icon: FileText, href: "/rapports/performance#individuels", phase: 3, permission: "evaluations.read" },
      { label: "Rapports sectoriels", icon: FileText, href: "/rapports/performance#collectifs", phase: 3, permission: "evaluations.read" },
      { label: "Rapports collectifs", icon: FileText, href: "/rapports/performance#collectifs", phase: 3, permission: "evaluations.read" },
      { label: "Rapports de match", icon: FileText, href: "/rapports/matchs", phase: 2, permission: "matches.read" },
      { label: "Bilans périodiques", icon: FileText, href: "/rapports/performance#bilans", phase: 3, permission: "evaluations.read" },
      { label: "Documents officiels", icon: FileText, href: "/rapports/documents", phase: 2, permission: "matches.read" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Utilisateurs", icon: Users, href: "/administration/utilisateurs", phase: 1, permission: "users.manage" },
      { label: "Rôles", icon: ShieldCheck, href: "/administration/roles", phase: 1, permission: "roles.read" },
      { label: "Permissions", icon: KeyRound, href: "/administration/roles#matrice", phase: 1, permission: "roles.read" },
      { label: "Paramètres", icon: Settings, href: "/administration/parametres", phase: 1, permission: "settings.manage" },
      { label: "Sauvegardes", icon: Database, href: "/administration/sauvegardes", phase: 1, permission: "backups.manage" },
      { label: "Journal d'activité", icon: ScrollText, href: "/administration/journal", phase: 1, permission: "audit.read" },
    ],
  },
];
