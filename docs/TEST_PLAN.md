# Plan de tests

| Type | Outil | Commande | Phase 1 |
|---|---|---|---|
| TypeScript | tsc | `npm run typecheck` | ✅ 0 erreur |
| Lint | ESLint | `npm run lint` | ✅ 0 erreur |
| Compilation | next build | `npm run build` | ✅ 28 routes |
| Unitaires | Vitest | `npm test` | ✅ 3/3 (bilan des matchs) |
| Sécurité / permissions | Vitest + Supabase local | `npm run test:security` | ✅ 14/14 |
| Parcours fonctionnels | Playwright | (script de recette, voir ci-dessous) | ✅ 15 étapes |
| Responsive | Playwright 390 px et 1440 px | captures | ✅ vérifié visuellement |
| PWA | manifest + service worker | contrôle manuel | ✅ manifest valide, SW limité au statique |
| Sauvegarde | export JSON | parcours | ✅ admin 200, entraîneur 403 |

## Scénarios de sécurité couverts
Anonyme sans accès ; compte sans rôle (métadonnées « admin ») sans accès ; joueuse limitée à sa fiche et sa photo ; communication sans documents ; intendant et communication sans écriture ; auto-attribution de rôle refusée ; attribution par non-admin refusée ; attribution/révocation par admin historisée ; admin sans permission médicale ; e-mail du profil non modifiable ; audit tracé et non supprimable ; stockage photo selon permissions.

## Parcours de recette Phase 1
Réinitialisation de mot de passe par e-mail → création saison et compétition → création d'une joueuse avec photo et poste → refus d'un numéro de maillot en double → dépôt d'un document avec échéance → création d'un membre du staff → invitation d'un entraîneur (e-mail personnalisé) → activation du compte entraîneur sur mobile → refus de l'accès aux Utilisateurs et aux Documents → export refusé (403) → déclaration de disponibilité par l'entraîneur → export par l'admin.

## À ajouter dans les phases suivantes
Calcul des indices (N/E, seuils, sources), confidentialité du onze provisoire, accès clip vs vidéo source, confidentialité médicale, exports PDF/PNG, restauration de sauvegarde.
