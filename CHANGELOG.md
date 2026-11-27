# Journal des modifications

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
