# Plan de tests

| Type | Outil | Commande | Phase 1 | Phase 2 |
|---|---|---|---|---|
| TypeScript | tsc | `npm run typecheck` | ✅ 0 erreur | ✅ 0 erreur |
| Lint | ESLint | `npm run lint` | ✅ 0 erreur | ✅ 0 erreur |
| Compilation | next build | `npm run build` | ✅ 28 routes | ✅ |
| Unitaires + intégration BDD | Vitest (+ PGlite) | `npx vitest run tests/unit tests/local` | ✅ 3/3 | ✅ 30/30 |
| Sécurité / permissions | Vitest + Supabase local | `npm run test:security` | ✅ 14/14 | ✅ 14/14 |
| Parcours fonctionnels | Playwright | `node tests/e2e/recette-phase2.cjs` | ✅ 15 étapes | ✅ 24 étapes |
| Responsive | Playwright 390 px et 1440 px | captures | ✅ | ✅ |

## Scénarios de sécurité couverts
Anonyme sans accès ; compte sans rôle (métadonnées « admin ») sans accès ; joueuse limitée à sa fiche et sa photo ; communication sans documents ; intendant et communication sans écriture ; auto-attribution de rôle refusée ; attribution par non-admin refusée ; attribution/révocation par admin historisée ; admin sans permission médicale ; e-mail du profil non modifiable ; audit tracé et non supprimable ; stockage photo selon permissions.

## Parcours de recette Phase 1
Réinitialisation de mot de passe par e-mail → création saison et compétition → création d'une joueuse avec photo et poste → refus d'un numéro de maillot en double → dépôt d'un document avec échéance → création d'un membre du staff → invitation d'un entraîneur (e-mail personnalisé) → activation du compte entraîneur sur mobile → refus de l'accès aux Utilisateurs et aux Documents → export refusé (403) → déclaration de disponibilité par l'entraîneur → export par l'admin.

## Parcours de recette Phase 2
Bibliothèque (2 exercices avec schéma) → rencontre (J-3) → séance n°1 avec 2 exercices (40 min) → Brouillon → Validé → Publié avec historique → 22 présences → évaluation → activité et programme J → calendrier 4 vues → macro/mésocycle → convocation (limite 18 bloquante, 2 réservistes, commentaire confidentiel) → onze provisoire puis validé et communiqué, export PNG → délégation (import, staff, validation) → événements du match et score → rapport après-match → classement → documents imprimables → tableau de bord → adjoint (notifié, ne peut ni modifier une séance publiée ni valider) → communication (pas de planification, onze communiqué en lecture seule, pas de commentaire confidentiel) → team manager (délégation validée verrouillée).

Les données de recette (`tests/e2e/fixtures/phase2-setup.sql`) ne servent que sur la pile locale ; aucune donnée fictive n'est mise en production.

## À ajouter dans les phases suivantes
Calcul des indices (N/E, seuils, sources), confidentialité du onze provisoire, accès clip vs vidéo source, confidentialité médicale, exports PDF/PNG, restauration de sauvegarde.
