# Journal des modifications

## [0.9.0] — 2026-11-27 — Phase 4 · livraison 1 : plans de développement (PDI)

### Ajouté
- Plans de développement (migration 015) individuels, sectoriels et collectifs : période, responsable du suivi (notifié), constats factuels et analyse du staff séparés, statut.
- Objectifs mesurables : dimension, mesure, point de départ, cible, unité, échéance, priorité. Pour une joueuse, le point de départ et les axes de travail viennent des évaluations validées (Phase 3) ; la mesure actuelle d'un objectif relié à un critère est relue en direct (aucune copie).
- Exercices correctifs : exercice de la bibliothèque ou consigne libre, fréquence ; vue regroupée par exercice pour préparer les séances.
- Réévaluations datées : résultat et valeur mesurée par objectif, faits et interprétation, décision (poursuivre, ajuster, prolonger, clôturer), prochaine échéance reportée sur le plan ; enregistrement tout-ou-rien (`add_development_review`).
- Vues Objectifs et Réévaluations (retards signalés), carte « Réévaluations à faire » sur le tableau de bord, lien depuis le profil 360°, plan imprimable (PDF/PNG) avec signatures.

## [0.8.0] — 2026-11-27 — Phase 3 · livraison 5 : tableau tactique et coups de pied arrêtés

### Ajouté
- Tableau tactique (menu Tactique) : le tableau existant reçoit le nom des joueuses sous les pions (choix dans l'effectif, numéro de la saison repris) ou un nom libre ; version imprimable de toutes les étapes d'un schéma (PDF via le navigateur, PNG) aux couleurs du club.
- Coups de pied arrêtés (migration 014) : carnet confidentiel du staff technique, groupé par catégorie (corners, coups francs, penalties, touches, offensifs et défensifs), côté, signal, déroulement et consignes, tireuses dans l'ordre, responsabilités individuelles, schéma animé propre à chaque combinaison, dupliquer, archiver, restaurer, supprimer (confirmation en deux temps). Carnet complet et fiche par combinaison imprimables.
- La base vérifie que les tireuses et joueuses désignées appartiennent au club, sans doublon, et qu'un rôle est saisi pour chaque responsabilité.

## [0.7.0] — 2026-11-27 — Phase 3 · livraison 4 : adversaires, rapports et tâches du staff

### Ajouté
- Analyse des adversaires (migration 013) : fiches d'observation confidentielles (staff technique) par adversaire et par match, faits observés (possession, hors possession, transitions, coups de pied arrêtés, joueuses clés) séparés de la lecture du staff (forces, faiblesses, interprétation, plan de jeu), sauvegarde automatique, confrontations. Les prochains adversaires apparaissent en premier.
- Rapports imprimables (PDF via le navigateur, PNG) aux couleurs du club : rapport d'avant-match, rapport individuel, rapport collectif (sectoriel et intersectoriel), bilan périodique (mensuel, saison). Construits uniquement à partir des données validées.
- Tâches du staff : création, attribution à un membre du staff (notification), échéance, priorité, statut, lien vers un match ou une séance, retards signalés, carte « Mes tâches » sur le tableau de bord.

## [0.6.0] — 2026-11-27 — Phase 3 · livraison 3 : projet de jeu et performance collective

### Ajouté
- Projet de jeu versionné (migration 012) : 5 moments du jeu pondérés (25/30/15/20/10), 41 principes du cahier des charges (§9) avec description, comportements attendus, critères d'évaluation, sous-principes et exercices liés. Une version publiée est figée ; une nouvelle version se crée par copie et ne se publie que si les moments totalisent 100 % et ont chacun un principe.
- Systèmes de jeu et animations : système de référence du club, animations en possession, hors possession et en transition, placement des joueuses à la souris, au doigt ou au clavier.
- Évaluations collectives (match ou entraînement) : principes du projet de jeu, 7 secteurs × 5 critères, 8 relations × 4 critères, notes 1 à 5 ou N/E, fait observé et interprétation séparés, distances entre les lignes comparées aux objectifs de compacité (objectif copié dans la mesure), circuit de validation, verrouillage, notification.
- Indices collectifs calculés uniquement sur les évaluations collectives validées : IPC, IMP (maîtrise du projet), IPS (secteurs), IPR (relations), IDC et IDS (progression comparable). Page « Performance collective », tuile IPC du tableau de bord, accès depuis le Match Center.

## [0.5.0] — 2026-11-27 — Phase 3 · livraison 2 : tests techniques et IDI

### Ajouté
- Tests techniques standardisés (migration 011) : les 12 protocoles du cahier des charges (§21) avec conditions types modifiables, nombre de tentatives, critères techniques alimentés, barème des tests chronométrés. Toute modification des conditions ou du barème crée une nouvelle version du protocole.
- Séances de tests : protocoles et joueuses choisis (présentes à la séance proposées), conditions de réalisation, grille de saisie (tentatives, réussites, erreurs, temps, observation) avec indice en direct et sauvegarde automatique, circuit de validation, verrouillage et notification. Chaque résultat garde une copie du protocole utilisé.
- La source « Tests » (20 %) entre dans la note technique, pondérée par les critères du poste ; critères non mesurés ou non applicables ignorés.
- IDI (indice de développement individuel) : compare uniquement des mesures comparables (même protocole et même version ; même référentiel, même poste, même contexte pour les évaluations), en points et en %. Profil 360° : tableau des tests, évolution, carte « Développement ». Tableau de bord : « Progression générale (IDI) ».

## [0.4.0] — 2026-11-27 — Phase 3 · livraison 1 : référentiels et évaluation individuelle

### Ajouté
- Référentiels d'évaluation versionnés (migration 010) : 6 dimensions, 92 critères (référentiel technique commun et gestes par poste, tactique, athlétique observée, cognitive, mentale, comportementale), pondérations globales et techniques des 9 postes du cahier des charges. Une version publiée est figée ; une nouvelle version se crée par copie et ne se publie que si chaque poste totalise 100 %.
- Évaluations de match ou d'entraînement : joueuses proposées depuis la convocation ou les présences, poste réellement occupé, notes 1 à 5 ou N/E, fait observé et interprétation séparés, commentaire, sauvegarde automatique, circuit Brouillon → Soumis → Validé → Publié, verrouillage après validation, notification.
- Moteur d'indices : N/E exclu du calcul, sources techniques 20/30/50 renormalisées, IPI pondéré par poste, seuil de publication configurable, couverture des critères et niveau de fiabilité.
- Performance individuelle : tableau de l'effectif par période, profil 360° (radar, courbe de progression, détail des critères, historique avec évaluateur et version du référentiel).
- Tableau de bord : indices par dimension alimentés par les évaluations validées, joueuse en focus, accès rapide « Évaluer une joueuse ». Fiche joueuse : carte « Profil de performance 360° ».

## [0.3.2] — 2026-11-27 — Affiche du onze de départ

### Ajouté
- Affiche partageable du onze de départ (onglet Onze de départ › « Affiche du onze ») : terrain vu de dessus, titulaires placées selon le tableau du onze, photo, numéro de dossard en rose, nom, capitaine ; système, remplaçantes et capitaine en option. Formats 4:5, carré, story ; exports PNG / JPEG HD, WhatsApp, partage.

### Modifié
- Affiche des convoquées : numéros de dossard en rose ; barre d'outils et exports mis en commun avec l'affiche du onze.

## [0.3.1] — 2026-11-27 — Affiche des convoquées

### Ajouté
- Affiche partageable des joueuses convoquées pour chaque match (onglet Convocation › « Affiche des convoquées ») : logo officiel, titre, bandeau du match, grille de cartes joueuse (photo, numéro, nom, poste) qui s'adapte au nombre de convoquées.
- Formats portrait 4:5, carré et story 9:16 ; exports PNG HD et JPEG HD (2160 px de large), version WhatsApp allégée, partage direct depuis le téléphone. Mention « Provisoire » tant que la convocation n'est pas validée.
- Aucune migration : les photos du stockage privé sont lues avec la session de l'utilisateur.

## [0.3.0] — 2026-11-27 — Fiches de séance professionnelles

### Ajouté
- Migration 009 (compatible, aucune colonne supprimée) : phases de séance, thèmes et sous-thèmes, matériel, schémas tactiques éditables (données JSON), modèles de séance, minutes / RPE / sRPE par joueuse, évaluation par critères et bilan du staff, permission `planning.export`.
- Fiche de séance en 8 étapes avec sauvegarde automatique, barre de progression et contrôle de complétude (soumission et validation bloquées tant que les points obligatoires manquent).
- Construction par phases (nombre libre) et exercices : glisser-déposer, flèches sur mobile, durées calculées (séries, récupérations, pauses), horaires de début et de fin automatiques, alerte de dépassement de l'horaire.
- Contenu pédagogique complet des exercices (organisation, déroulement, consignes, contraintes, critères de réalisation et de réussite, points de coaching, variantes, vidéos).
- Tableau tactique 2D : terrains (entier, demi, tiers, surface, zone libre), joueuses par équipe, gardiennes, ballon, plots, coupelles, mannequins, mini-buts, buts, piquets, échelles, haies, flèches (déplacement, passe, conduite, frappe, courbes), zones hachurées, cotes, annotations, étapes animées, annuler / rétablir, raccourcis clavier, import / export des données, export PNG, JPEG, SVG.
- Effectif (disponibilité du jour, présence, participation), matériel repris des schémas, charge prévue et réalisée (RPE, sRPE, moyennes), liens vidéo.
- 6 modèles imprimables (fiche complète, fiche terrain, fiche résumée, compte rendu, fiche exercice, programme de la semaine) en A4 / A3, portrait / paysage, avec en-tête officiel, saison, numéro de séance, pagination et état de validation. Aperçu, impression, PDF (texte sélectionnable, schémas vectoriels), JPEG 300 DPI, version WhatsApp, PNG HD, ZIP de toutes les pages, partage.
- Duplication, modèles de séance, bibliothèques des thèmes et des schémas, tableau de bord Entraînement (assiduité, charge hebdomadaire, évaluations).

### Modifié
- Les anciennes pages « Modifier » et « Présences » d'une séance, et l'impression HTML, redirigent vers l'étape correspondante de la fiche.
- Menu latéral : l'entrée la plus précise est seule mise en évidence.


## [0.2.0] — 2026-11-26 — Phase 2 « Sport management »

### Ajouté
- Base de données : 3 migrations (planification, compétition, correctif des notifications), 19 tables sous RLS, 41 permissions, workflow Brouillon → Soumis → Validé → Publié → Archivé contrôlé en base et historisé (`approval_history`), notifications du staff à la publication et aux changements d'horaire.
- Calendrier de la saison (vues jour, semaine, mois, année) et événements (activités, réunions, voyages…).
- Macrocycles, mésocycles (dates contrôlées dans le macrocycle), microcycles ; programme hebdomadaire avec références J-6…J et J+1 automatiques, semaines à plusieurs matchs, duplication, validation, publication, export PDF.
- Bibliothèque d'exercices (15 catégories, schéma en image, filtres, archivage).
- Fiches de séance : numéro automatique, blocs, exercices de la bibliothèque, durée totale, présences, évaluation post-séance, duplication, workflow.
- Match Center : avant-match, direct (événements minutés : buts, passes, cartons, remplacements), après-match (rapport et statistiques calculées depuis la composition officielle).
- Convocations : limite de la compétition (18 par défaut) bloquante, réservistes, commentaires confidentiels invisibles hors staff habilité, export PDF/PNG.
- Onze de départ : terrain interactif (glisser-déposer), système de jeu, remplaçantes, capitaine, tireuses (penalties, coups francs, corners), versions provisoires confidentielles, historique des versions, validation, communication, export PNG.
- Délégations : document officiel avec logo et trois espaces de signature, import des convoquées, staff, chambres.
- Résultats, classement (contrôle V+N+D=J), statistiques de la saison, rapports de match, documents officiels.
- Tableau de bord : prochaine séance, programme de la semaine, classement.
- Tests : tests d'intégration Phase 2 (PGlite), recette navigateur en 24 étapes multi-rôles.

### Corrigé
- Création d'un microcycle impossible (« record new has no field session_date ») : fonction `app.notify_planning` corrigée (migration 008).
- Champs facultatifs absents d'un formulaire considérés à tort comme invalides.
- Formulaires vidés après une erreur d'enregistrement.


## [0.1.0] — 2026-11-26 — Phase 1 « Foundation »

### Ajouté
- Socle Next.js 16 / TypeScript / Tailwind 4 / Supabase ; PWA installable (manifest, icônes issues du logo officiel, service worker limité aux fichiers statiques, page hors connexion).
- Base de données : 5 migrations (institution, rôles et permissions, effectif, staff, disponibilité sportive, noyau compétition, notifications, audit), RLS sur toutes les tables, 4 buckets privés.
- 12 rôles, 39 permissions, matrice versionnée ; anti-escalade (auto-attribution interdite, dernier administrateur protégé, attributions révocables et historisées).
- Authentification par invitation, réinitialisation du mot de passe, politique de mot de passe (10 caractères, majuscule, minuscule, chiffre).
- Design system (tokens officiels, mode sombre par défaut, mode clair, contrastes AA mesurés).
- Tableau de bord : bandeau institutionnel, indicateurs réels (effectif, disponibilités, bilan des matchs), indices « Non évalué », disponibilité, effectif par secteur, alertes administratives, prochain match, staff, accès rapides, widgets à venir signalés par phase.
- Effectif : liste filtrable, fiche complète, création/modification avec photo compressée, postes principal et secondaires, numéro unique par saison, archivage.
- Disponibilité sportive (sans donnée médicale), documents administratifs (liens de téléchargement de 5 minutes), staff technique.
- Administration : utilisateurs (invitation, attribution, révocation), matrice des rôles, paramètres (club, saisons, compétitions), journal d'activité paginé, export JSON des données du club.
- Recherche globale, notifications, compte utilisateur, espace joueuse (accueil).
- Tests : 3 tests unitaires, 14 tests d'intégration de sécurité, parcours navigateur en 15 étapes.
