# Journal des modifications

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
