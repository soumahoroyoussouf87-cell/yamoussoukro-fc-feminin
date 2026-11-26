# Journal des modifications

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
