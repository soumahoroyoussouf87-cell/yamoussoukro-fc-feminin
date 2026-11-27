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

## Recette « Fiches de séance » (27/11/2026)
`node tests/e2e/recette-seances.cjs` (après la recette Phase 2) : 16 étapes — création, horaires contrôlés, thèmes, 2 phases et 3 exercices (durée calculée 60 min), réorganisation, consignes, schéma dessiné et rechargé, présences, matériel, charge (360 UA prévues), évaluation, validation, exports des 6 modèles (PDF, JPEG 300 DPI, WhatsApp, ZIP, A3), modèle, duplication, pages annexes, mobile 390 px, verrouillage pour l'adjoint.
Tests unitaires : `tests/unit/training-sheets.test.ts` ; sécurité base : bloc « Fiches de séance » de `tests/local/phase2-security.test.ts`.

## Phase 3 · livraison 1 (27/11/2026)
- `tests/unit/performance-engine.test.ts` : échelle, N/E non pénalisant, pondérations par poste, sources 20/30/50 renormalisées, seuil, fiabilité, indices d'équipe.
- `tests/local/phase3-performance.test.ts` : référentiel initial (100 % par poste), figement des versions publiées, publication contrôlée, validation réservée et historisée, verrouillage, RLS (communication, administrateur, joueuse sans accès).
- `tests/e2e/recette-performance.cjs` (14 étapes) : versions, notation, seuil « Données insuffisantes », IPI, radar, progression, droits de l'adjoint, mobile 390 px.

## Phase 3 · livraison 2 (27/11/2026)
- `tests/unit/technical-tests.test.ts` : indice d'un résultat, source Tests, IDI (versions, temps sans barème, évaluations comparables).
- `tests/local/phase3-tests.test.ts` : 12 protocoles, versionnage, copie du protocole, indice, validation, verrouillage, RLS.
- `tests/e2e/recette-tests.cjs` : 11 étapes (protocole, saisie adjoint, validation, progression, IDI, droits, mobile 390 px).

## Phase 3 · livraison 3 (27/11/2026)
- `tests/unit/collective-engine.test.ts` : IPC pondéré, N/E exclu, IMP, IPS, IPR, compacité, IDC/IDS.
- `tests/local/phase3-game-model.test.ts` : projet initial (41 principes, 100 %), figement, clone et publication contrôlée, systèmes, validation, verrouillage, copie de l'objectif de compacité, RLS.
- `tests/e2e/recette-collective.cjs` : 12 étapes (brouillon, systèmes au clavier, saisie adjoint, validation, seuil, IPC, tableau de bord, Match Center, droits, mobile 390 px).

## Phase 3 · livraison 4 (27/11/2026)
- `tests/local/phase3-scouting-tasks.test.ts` : confidentialité des fiches adversaires, cohérence adversaire / match, attribution et notification des tâches, droits de modification et de suppression, date de fin.
- `tests/e2e/recette-l4.cjs` : 8 étapes (fiche adversaire, rapport d'avant-match, rapports individuel / collectif / bilan avec logo, tâche confiée puis terminée, droits, mobile 390 px).

## Phase 3 · livraison 5 (27/11/2026)
- `tests/unit/tactical-board.test.ts` : nom des joueuses accepté, dessiné (écran et exports), longueur contrôlée, nom court.
- `tests/local/phase3-set-pieces.test.ts` : création, joueuse d'un autre club, tireuse en double, rôle vide, catégorie invalide, confidentialité (intendance, communication, joueuse), archivage, journal, suppression.
- `tests/e2e/recette-l5.cjs` : 10 étapes (tableau tactique avec noms et 2 étapes, PDF de toutes les étapes, création d'une combinaison, fiche et tireuses, schéma animé, carnet imprimable, dupliquer / archiver / restaurer / supprimer, droits, mobile 390 px).

## Phase 4 · livraison 1 (27/11/2026)
- `tests/local/phase4-development.test.ts` : notification du responsable, portée et dates contrôlées, cohérence club, statut des objectifs suivant la dernière réévaluation (même saisie après coup), clôture, objectif étranger refusé, RPC tout-ou-rien, confidentialité (analyste en lecture seule, communication et joueuses sans accès).
- `tests/e2e/recette-pdi.cjs` : 10 étapes (création depuis le profil 360°, point de départ, objectifs suggérés et libres, exercices correctifs, réévaluation, vues transversales, plans sectoriel et collectif, clôture, tableau de bord, impression, droits, mobile 390 px).

## À ajouter dans les phases suivantes
Calcul des indices (N/E, seuils, sources), confidentialité du onze provisoire, accès clip vs vidéo source, confidentialité médicale, exports PDF/PNG, restauration de sauvegarde.
