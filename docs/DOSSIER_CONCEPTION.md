# YAMOUSSOUKRO FC FÉMININ — HIGH PERFORMANCE CENTER
## Dossier de conception (étape 54) — version 1.0 du 26 novembre 2026

> OBSERVER • ÉVALUER • PLANIFIER • DÉVELOPPER • PERFORMER

**État de l'environnement analysé** : aucun dépôt existant ; projet créé de zéro. Logo officiel (PNG à fond transparent, 1391 × 1131 px) et maquette du tableau de bord reçus et intégrés le 26/11/2026. La maquette sert de référence esthétique uniquement : ses noms, scores, classements et photographies ne sont pas repris.

---

## 1. Architecture technique

| Couche | Choix | Version vérifiée (npm, 26/11/2026) | Licence |
|---|---|---|---|
| Framework | Next.js (App Router, Server Components, Server Actions, `proxy.ts`) | 16.4.6 | MIT |
| UI | React | 19.3 | MIT |
| Langage | TypeScript (mode strict) | 5.x | Apache-2.0 |
| Styles | Tailwind CSS | 4.3 | MIT |
| Composants | Primitives au format shadcn/ui (cva + Radix) dans `src/components/ui` | radix-ui 1.8 | MIT |
| Base de données | PostgreSQL 17 (Supabase) | — | PostgreSQL |
| Authentification | Supabase Auth (e-mail + mot de passe, invitation uniquement) | supabase-js 2.119, @supabase/ssr 0.12 | MIT |
| Stockage | Supabase Storage — 4 buckets privés, URL signées courtes | — | Apache-2.0 |
| Sécurité des données | Row Level Security sur 100 % des tables | — | — |
| Validation | Zod | 4.6 | MIT |
| Icônes | Lucide | 1.81 | ISC |
| Graphiques | Recharts (radar, courbes : Phase 3) | 3.11 | MIT |
| Terrain tactique | react-konva / Konva (Phase 2-3) | 10.11 | MIT |
| Vidéo | Mux **ou** Cloudflare Stream + FFmpeg côté serveur (Phase 4) | — | à valider |
| Tests | Vitest (unitaires + intégration RLS), Playwright (parcours) | 5.1 | MIT |

**Principes**

1. **Rendu serveur, données confidentielles** : toutes les pages sont rendues à la requête avec la session de l'utilisateur (`cacheComponents` désactivé). Aucune donnée sportive n'est mise en cache partagé.
2. **Défense en profondeur** : (a) `proxy.ts` redirige tout visiteur non authentifié ; (b) chaque page et chaque Server Action appelle `requirePermission()` ; (c) la base applique la RLS, même si le code applicatif comportait une faille.
3. **Clé d'administration jamais exposée** : la clé `service_role` n'est lue que dans `src/lib/supabase/admin.ts` (module `server-only`), uniquement pour envoyer une invitation, après contrôle de `users.manage`.
4. **Permissions issues de la base** : `user_roles` → `role_permissions`. Les métadonnées du compte (modifiables par l'utilisateur) ne sont jamais lues pour décider d'un accès — testé.
5. **Multi-club / multi-catégorie / multisaison** : toute donnée porte `club_id` ; l'appartenance d'une joueuse à une équipe est portée par `player_seasons`.
6. **Connexions limitées** : photos compressées dans le navigateur (WebP 800 px) avant envoi, URL signées en lot (1 requête), polices auto-hébergées par Next, PWA ne mettant en cache que les fichiers statiques.

```
Navigateur (PWA)  ──HTTPS──▶  Next.js (Vercel ou serveur)  ──▶  Supabase
  React client                 proxy.ts (session)               Postgres + RLS
  formulaires                  Server Components (lecture)      Auth (invitations)
  compression photo            Server Actions (écriture, Zod)   Storage privé (URL signées)
                               lib/supabase/admin (invitation)  Triggers d'audit
```

## 2. Schéma relationnel

Phase 1 : 21 tables + 1 vue, toutes en UUID, avec clés étrangères, contraintes `check`, index et `created_at`/`updated_at` (trigger).

**Institution** : `clubs` 1—n `teams` ; `clubs` 1—n `seasons` (une seule active par club, index unique partiel) ; `seasons` 1—n `competitions` (taille de liste de convocation configurable, 18 par défaut) ; `application_settings` (saison/compétition actives, seuil d'observations avant publication d'un indice).

**Identité et droits** : `auth.users` 1—1 `profiles` ; `roles` n—n `permissions` via `role_permissions` ; `user_roles` (utilisateur × club × rôle × équipe optionnelle, révocation horodatée, jamais supprimée).

**Effectif** : `players` 1—n `player_seasons` (n° de maillot unique par saison et équipe) ; `players` n—n `positions` via `player_positions` (un seul poste principal) ; `player_documents` (fichier dans le bucket privé) ; `player_availability` (statut sportif daté, **sans donnée médicale**) ; vue `player_current_availability` (`security_invoker`, donc soumise à la RLS).

**Staff** : `staff_members` (fonction = rôle staff, lien facultatif vers un compte).

**Compétition (noyau)** : `opponents`, `matches` (score obligatoire si joué). Les écrans arrivent en Phase 2, mais le tableau de bord calcule déjà V/N/D, buts et clean sheets sur ces tables.

**Administration** : `notifications`, `audit_logs` (alimenté par triggers `SECURITY DEFINER` sur 15 tables, non modifiable par l'API).

**Tables des phases suivantes** (conformes au §45 du cahier des charges, créées phase par phase) : planification (`macrocycles` → `mesocycles` → `microcycles` → `training_sessions` → `session_exercises`), tactique (`game_models` + `game_model_versions` pour le versionnage), performance (`evaluation_frameworks` + `framework_versions` figées pour ne jamais modifier rétroactivement un référentiel), vidéo (`videos` 1—n `video_clips` n—n `players` via `clip_players` : une séquence liée à plusieurs joueuses sans dupliquer le fichier ; `video_access_grants` au niveau du clip), sport science et médical (schéma séparé `medical`, accès `medical.*` uniquement).

Détail colonne par colonne : `docs/DATABASE_SCHEMA.md`.

## 3. Design system

- **Palette officielle** (tokens CSS `--yfc-*`, inchangés) : bleu royal #063580, bleu nuit #07162E, rose fuchsia #FF0068, blanc, gris clair #F4F6FA, gris ardoise #64748B, vert #22C55E, orange #F59E0B, rouge #EF4444.
- **Tokens sémantiques** (`background`, `card`, `primary`, `muted-foreground`, `success`…) redéfinis pour le mode sombre (par défaut) et le mode clair.
- **Accessibilité mesurée** (ratios WCAG calculés) : blanc sur bleu nuit 18,1:1 ; blanc sur royal 11,5:1 ; ardoise #64748B sur fond sombre 3,5:1 → remplacée en mode sombre par #94A3B8 (6,6:1). Le fuchsia en **texte** est décliné en #D1005A sur fond clair (5,4:1) et #FF5C9D sur fond sombre (5,8:1). **Point à valider** : texte blanc sur bouton fuchsia = 3,85:1 (conforme seulement pour le texte large) ; alternative possible : texte bleu nuit sur fuchsia (4,7:1).
- **Typographies** : Barlow Condensed (titres, chiffres clés, majuscules) et Inter (contenus), servies par `next/font` — sous réserve de validation visuelle.
- **Composants** : Button, Card, Badge, Input/Select/Textarea/Field, Table, EmptyState, PageHeader, ConfirmButton (confirmation en deux temps des actions sensibles).
- **Règles** : état vide explicite partout ; tout module non livré affiché grisé avec son numéro de phase, jamais cliquable ; le statut n'est jamais porté par la couleur seule (icône + libellé) ; `prefers-reduced-motion` respecté.
- **Logo** : affiché tel quel (`object-contain`, aucune retouche, aucun filtre).

## 4. Arborescence des pages

| Route | Phase | Permission |
|---|---|---|
| `/connexion`, `/mot-de-passe-oublie`, `/definir-mot-de-passe`, `/auth/confirm` | 1 | publique / session |
| `/tableau-de-bord` | 1 | dashboard.read |
| `/effectif`, `/effectif/nouvelle`, `/effectif/[id]`, `/effectif/[id]/modifier` | 1 | players.read / players.write |
| `/disponibilites` | 1 | availability.read |
| `/documents` | 1 | players.documents.read |
| `/staff`, `/staff/nouveau`, `/staff/[id]/modifier` | 1 | staff.read / staff.write |
| `/administration/utilisateurs` | 1 | users.manage |
| `/administration/roles` (matrice) | 1 | roles.read |
| `/administration/parametres` (club, saisons, compétitions) | 1 | settings.manage |
| `/administration/journal` | 1 | audit.read |
| `/administration/sauvegardes` (+ export JSON) | 1 | backups.manage |
| `/notifications`, `/recherche`, `/mon-compte` | 1 | staff |
| `/espace-joueuse` (portail complet en Phase 5) | 1 | joueuse |
| Agenda, Planification, Entraînement, Compétition | 2 | planning.*, matches.*, lineups.* |
| Tactique, Performance, Rapports | 3 | evaluations.*, frameworks.manage, reports.* |
| Analyse vidéo, Développement | 4 | video.*, development.* |
| Sport science, Médical, Portail joueuse | 5 | sportscience.*, medical.* |
| Intelligence artificielle | 6 | ai.use |

## 5. Matrice des permissions (synthèse)

| Permission | Admin | Dir. sportive | Entr. principal | Adjoint | Gardiennes | Analyste | Prép. athl. | Médical | Team Mgr | Intendant | Comm. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Effectif (lecture) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Effectif (écriture) | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| Archiver une joueuse | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| Documents administratifs | ✓ | lecture | — | — | — | — | — | — | ✓ | — | — |
| Disponibilité (déclarer) | — | — | ✓ | — | — | — | ✓ | ✓ | ✓ | — | — |
| Staff (écriture) | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — |
| Compositions provisoires | — | ✓ | ✓ | ✓ | lecture | — | — | — | — | — | — |
| Valider une composition | — | ✓ | ✓ | — | — | — | — | — | — | — | — |
| Évaluations (saisie / validation) | — | valid. | ✓ / ✓ | ✓ / — | ✓ / — | ✓ / — | ✓ / — | — | — | — | — |
| Vidéo (import / partage) | — | lecture | ✓ / ✓ | ✓ / — | lecture | ✓ / ✓ | — | — | — | — | — |
| Dossiers médicaux | — | — | — | — | — | — | — | ✓ | — | — | — |
| Utilisateurs et rôles | ✓ | — | — | — | — | — | — | — | — | — | — |
| Journal d'audit | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| Paramètres | ✓ | ✓ | — | — | — | — | — | — | — | — | — |

La **joueuse** n'a aucune permission staff : la RLS ne lui ouvre que sa propre fiche, ses postes, sa disponibilité, ses documents et sa photo. L'**administrateur** technique n'a volontairement aucun accès médical ni aux compositions. Matrice complète (39 permissions × 12 rôles) visible dans l'application : Administration › Rôles.

## 6. Plan de développement

| Phase | Contenu | Critère de sortie |
|---|---|---|
| 1 Foundation | Architecture, design system, auth, BDD, RLS, tableau de bord, effectif, staff, administration | Critères §8 verts |
| 2 Sport management | Calendrier, macro/méso/microcycles, programme hebdo (J-6…J+1), fiches de séance, bibliothèque d'exercices, présences, Match Center, convocations (18 configurable), délégations, onze de départ (terrain Konva, workflow Brouillon→Validé), résultats, classement, exports PDF/PNG | Onze provisoire invisible des rôles non autorisés (test RLS) ; exports conformes à la charte |
| 3 Performance framework | Projet de jeu versionné, systèmes, référentiels et pondérations versionnés, tests techniques, évaluations individuelles/sectorielles/intersectorielles/collectives, indices IPI…IMP | Tests de calcul (N/E non pénalisant, seuil de publication, sources 20/30/50) |
| 4 Vidéo & développement | Import reprenable, transcodage, lecteur pro, codification, playlists, annotations, comparaison, PDI | Joueuse : accès au clip seul, jamais au match source (test) |
| 5 Sport science | Tests physiques, import CSV GPS, sRPE, médical (schéma séparé), portail joueuse | Données médicales inaccessibles hors staff médical (test) |
| 6 Intelligence | YFC PERFORMANCE AI : synthèses sourcées, recommandations soumises à validation | Chaque sortie cite ses sources ; aucune donnée médicale transmise |
| 7 Advanced data | Vision par ordinateur, tracking, analyse spatiale | Modèles validés avant toute présentation comme opérationnels |

## 7. Dépendances nécessaires

- **Installées (Phase 1)** : next, react, react-dom, @supabase/supabase-js, @supabase/ssr, zod, lucide-react, radix-ui, class-variance-authority, clsx, tailwind-merge, server-only, recharts ; dev : typescript, tailwindcss, eslint, vitest, supabase (CLI), pg.
- **À ajouter plus tard** : react-konva/konva (P2), @react-pdf/renderer ou Playwright PDF (P2), exceljs (P3), @mux/mux-node ou API Cloudflare Stream + tus-js-client (P4), papaparse (P5), SDK du fournisseur IA retenu (P6).
- **Services externes** : projet Supabase (obligatoire), hébergement Next.js (Vercel ou VPS), service e-mail SMTP (invitations), fournisseur vidéo (P4), fournisseur IA (P6). **Aucun compte n'a été créé : chaque création attend votre accord.**

## 8. Critères d'acceptation de la Phase 1

1. Compilation de production et vérification TypeScript sans erreur ; ESLint sans erreur.
2. Aucun accès anonyme aux données (test).
3. Un compte sans rôle ne voit aucune donnée, même avec des métadonnées « admin » (test).
4. Une joueuse ne voit que sa propre fiche et sa propre photo (test).
5. Personne ne peut s'attribuer un rôle ; le dernier administrateur ne peut pas être retiré ; seul `users.manage` attribue des rôles (tests).
6. L'administrateur n'a pas accès au médical (test).
7. Toute écriture est tracée dans un journal non modifiable (test).
8. Parcours réel validé dans un navigateur : réinitialisation du mot de passe par e-mail, création de saison et compétition, création d'une joueuse avec photo et poste, refus d'un numéro de maillot en double, dépôt d'un document, déclaration de disponibilité, création d'un membre du staff, invitation d'un entraîneur, refus d'accès de l'entraîneur aux pages réservées, export réservé à l'administrateur.
9. Tableau de bord : uniquement des données réelles ; indices « Non évalué » tant qu'aucune évaluation n'existe ; modules futurs signalés par leur phase.
10. Mode sombre par défaut, mode clair, affichage smartphone vérifié.

## 9. Risques techniques

| Risque | Impact | Parade |
|---|---|---|
| Bande passante limitée en Côte d'Ivoire | Lenteur, échecs d'envoi | Compression côté client, URL signées en lot, vidéo adaptative 480p par défaut, upload reprenable (tus) en P4 |
| Coût du stockage vidéo | Budget | Pas de duplication (clips = repères sur la vidéo source), archivage des saisons anciennes, originaux 4K facultatifs, suivi des quotas |
| Formats et API des caméras (VEO, Once Sport, XbotGo…) non documentés | Intégration automatique impossible | Import manuel MP4 d'abord ; intégrations seulement après confirmation des API et licences |
| Fuite de données confidentielles (onze, médical) | Grave | RLS + tests multi-rôles à chaque phase, schéma médical séparé, pas de cache hors connexion |
| Mauvaise configuration de production (clé service exposée, RLS désactivée) | Grave | Variables serveur uniquement, `scripts/test-security.sh` à exécuter avant chaque mise en production |
| Données personnelles de mineures (catégories jeunes) | Juridique | Autorisations parentales et consentement image gérés comme documents ; durée de conservation à définir (PRIVACY.md) ; loi ivoirienne n° 2013-450 |
| IA produisant des contenus inventés | Décisions faussées | Réponses construites uniquement à partir d'extraits sourcés, validation obligatoire par le staff |
| Contraste du bouton fuchsia | Accessibilité | Variante proposée, à arbitrer par le club |

## 10. Coûts des services externes (estimations indicatives, à revérifier au moment de souscrire)

| Service | Offre de départ | Ordre de grandeur |
|---|---|---|
| Supabase | Pro (8 Go base, 100 Go stockage, sauvegardes quotidiennes) | ~25 USD/mois + dépassements |
| Hébergement Next.js | Vercel Pro (ou VPS) | ~20 USD/mois par membre (VPS : 10-20 USD/mois) |
| E-mails transactionnels | Resend / Brevo | gratuit à faible volume, puis ~15-20 USD/mois |
| Vidéo (P4) | Mux ou Cloudflare Stream | à l'usage : encodage + stockage + minutes visionnées ; Cloudflare Stream ~5 USD / 1 000 min stockées + 1 USD / 1 000 min diffusées |
| IA (P6) | API d'un modèle de langage | à l'usage, de quelques à quelques dizaines d'USD/mois selon les rapports générés |
| Nom de domaine | .ci ou .com | ~15-40 USD/an |

Ces montants sont des ordres de grandeur publics connus à ce jour : ils doivent être confirmés sur les grilles tarifaires officielles avant tout engagement.
