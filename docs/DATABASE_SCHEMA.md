# Schéma de la base de données

Source de vérité : `supabase/migrations/*.sql`. Toutes les tables : `id uuid` (sauf mention), `created_at`, `updated_at` (trigger `app.set_updated_at`), RLS activée.

## Phase 1

| Table | Colonnes clés | Contraintes |
|---|---|---|
| clubs | name, short_name, tagline, city, country, logo_path | |
| teams | club_id, name, category (enum), is_default | unique(club, name) ; une équipe par défaut par club |
| seasons | club_id, label, starts_on, ends_on, is_active | fin > début ; une saison active par club |
| competitions | club_id, season_id, team_id, name, type, squad_size_limit (11-40, défaut 18), is_primary | unique(saison, équipe, nom) |
| profiles | id = auth.users.id, full_name, email, theme, locale | créé par trigger ; e-mail non modifiable par l'utilisateur |
| roles | code, label, description, is_staff, sort_order | 12 rôles |
| permissions | code (`module.action`), module, label, is_sensitive, phase | 39 permissions |
| role_permissions | role_id, permission_id | PK composée ; écriture par migration uniquement |
| user_roles | user_id, club_id, role_id, team_id?, granted_by, granted_at, revoked_at | unique actif ; jamais supprimée ; trigger anti-escalade |
| positions | code (GB, DC, DD, DG, PD, PG, N6, N8, N10, AD, AG, N9), label, line, framework_key | référentiel global |
| players | club_id, profile_id?, first_name, last_name, birth_date, nationality, height_cm (120-220), preferred_foot, photo_path, joined_on, admin_status, licence_number, archived_at | licence unique par club |
| player_seasons | player_id, season_id, team_id, shirt_number (1-99), tactical_role, status | n° unique par saison+équipe |
| player_positions | player_id, position_id, is_primary | un seul principal |
| player_documents | player_id, kind, title, storage_path, expires_on, uploaded_by | |
| player_availability | player_id, status, reason, sporting_note (≤500), starts_on, expected_end_on, ended_on | motif obligatoire si non disponible ; **aucune donnée médicale** |
| player_current_availability (vue) | statut du jour | `security_invoker` |
| staff_members | club_id, team_id?, profile_id?, role_id, identité, contact, qualifications, dates, status | e-mail validé |
| opponents | club_id, name, city, logo_path | unique(club, nom) |
| matches | club_id, team_id, season_id, competition_id?, opponent_id, kickoff_at, venue, home_away, matchday, status, goals_for, goals_against | score obligatoire si « joue » |
| application_settings | club_id (PK), active_season_id, active_competition_id, default_team_id, min_observations_for_index, settings jsonb | |
| notifications | club_id, user_id, kind, title, body, link, read_at | seul read_at modifiable |
| audit_logs | id bigint, club_id, actor_id, action, table_name, record_id, old_data, new_data | lecture seule via l'API |

## Fonctions de sécurité (schéma `app`, non exposé)
`has_permission(club, code)`, `is_club_member(club)`, `is_club_staff(club)`, `my_player_id()`, `can_view_profile(id)`, `guard_user_roles()`, `audit_row()`, `path_club(name)`, `path_player(name)`, `bootstrap_first_admin(email, club)`.
RPC exposées : `my_memberships()`, `my_permissions(club)` (utilisateur connecté), `bootstrap_first_admin` (service_role uniquement).

## Stockage (buckets privés)
`club-assets`, `player-photos`, `staff-photos`, `player-documents`. Chemin : `{club_id}/{entité_id}/{fichier}`. Politiques dérivées des permissions du club et, pour la joueuse, de sa propre fiche.

## Tables Phase 2 (migrations 006 à 008)
| Table | Rôle |
|---|---|
| macrocycles, mesocycles, microcycles | planification ; microcycle avec workflow |
| calendar_events | activités, réunions, voyages… |
| exercises | bibliothèque (15 catégories, schéma dans le bucket `exercise-diagrams`) |
| training_sessions, session_exercises | fiche de séance (numéro automatique, workflow), exercices par bloc |
| training_attendance, session_evaluations | présences (unique séance + joueuse), évaluation post-séance |
| approval_history | historique de toutes les transitions de workflow |
| match_squads, match_squad_players | convocation, limite de la compétition ; `confidential_comment` protégé par privilège de colonne |
| lineups, lineup_players, lineup_snapshots | onze versionné (provisoire → validé → communiqué), historique des versions |
| match_events | événements minutés du match |
| delegations, delegation_members | délégation officielle, verrouillée après validation |
| standings | classement saisi |

Fonctions ajoutées : `app.guard_workflow(perm)`, `app.track_status()`, `app.notify_staff()`, `app.notify_planning()` (corrigée en 008).

## Fiches de séance (migration 009)
| Table / colonnes | Rôle |
|---|---|
| training_themes | thèmes et sous-thèmes (parent_id) |
| tactical_diagrams | schémas éditables (`data` JSON : terrain, éléments, étapes d'animation) |
| session_phases | phases ordonnées d'une séance ; `session_exercises.phase_id`, séries, récupération (s), pause |
| session_equipment | matériel de la séance |
| session_templates | modèles (copie JSON des informations, phases, exercices et matériel) |
| training_attendance.participation, minutes, rpe, srpe | charge individuelle (`srpe` = minutes × RPE, calculé) |
| session_evaluations.criteria, appreciation, difficulties, corrections, next_objective | évaluation par critères et bilan |

Fonctions : `app.set_updated_by()`, `app.guard_same_club()` (phase, schéma et thème du même club / de la même séance).

## Performance Framework (migration 010)
- `evaluation_frameworks` (un référentiel individuel par club) → `framework_versions` (brouillon / publié / archivé, une seule version publiée et un seul brouillon, figée hors brouillon : triggers `guard_framework_version`, `guard_framework_children`).
- `evaluation_dimensions` (6 codes), `evaluation_criteria` (`default_weight` = poids pour tous les postes, null = critère réservé aux postes pondérés), `position_criteria_weights` (poste × critère), `position_dimension_weights` (poste × dimension).
- `evaluation_sessions` (contexte match / entraînement, version figée, workflow `guard_workflow('evaluations.validate')`, historique, notification) → `individual_evaluations` (joueuse, poste occupé, minutes) → `evaluation_scores` (note 1-5, null = N/E, fait observé, interprétation) → `evaluation_evidence` (lien https).
- RPC `clone_framework_version`, `publish_framework_version` (contrôle 100 % par poste). Référentiel initial créé par `app.seed_performance_framework` pour chaque club.
- RLS : lecture `evaluations.read` ; référentiels `frameworks.manage` ; saisie `evaluations.write` ; contenu d'une évaluation validée modifiable seulement avec `evaluations.validate`.

## Tests techniques (migration 011)
- `technical_test_protocols` : protocole par club (code, conditions, mesure réussite/temps, tentatives, barème `ref_best`/`ref_limit`, `criterion_codes`, `version_no`, `active`). Pas de suppression ; changement des conditions ou du barème = version + 1 (trigger).
- `technical_test_sessions` : date, lieu, conditions, `protocol_ids`, `player_ids`, statut du circuit de validation (`evaluations.validate`).
- `technical_test_results` : tentatives, réussites, erreurs, temps, observation ; copie du protocole (version, mesure, barème, critères) et `index_value` calculés par la base. Verrouillés après validation.
- RLS : lecture `evaluations.read` ; protocoles `frameworks.manage` ; séances et résultats `evaluations.write` (validation `evaluations.validate`).

## Projet de jeu et performance collective (migration 012)
- `game_models` (un par club) → `game_model_versions` (brouillon / publié / archivé, figée hors brouillon) → `game_moments` (5 codes, pondération), `game_principles` (comportements attendus, critères d'évaluation), `game_subprinciples`, `game_principle_exercises`.
- `game_systems` : système de référence (`is_reference` unique par club) et animations (`parent_id`, phase possession / hors possession / transitions), placement `slots` jsonb.
- `collective_evaluations` (version publiée figée, contexte match / entraînement, système utilisé, workflow) → `collective_scores` (principe / secteur / relation, note 1-5 ou N/E, fait, interprétation ; codes contrôlés) et `collective_measures` (distance entre lignes, objectif copié par `app.compute_collective_measure`).
- `compactness_targets` : objectif min-max par situation et relation de lignes.
- RPC `clone_game_model_version`, `publish_game_model_version` (100 % et un principe par moment pondéré). Projet initial : `app.seed_game_model`.
- RLS : lecture `evaluations.read` ; projet, systèmes, objectifs `frameworks.manage` ; évaluations `evaluations.write` (validation `evaluations.validate`).

## Tables prévues (phases 3 à 6)
Conformément au §45 du cahier des charges : planification, compétition complète (`match_squads`, `lineups` avec statut de workflow et historique, `match_events`, `delegations`…), tactique (`game_models`, `game_model_versions`…), performance (`evaluation_frameworks`, `framework_versions`, `position_criteria_weights`, `evaluation_scores`, `evaluation_evidence`, `performance_snapshots`…), vidéo (`videos`, `video_clips`, `clip_players`, `video_access_grants`…), développement, sport science, schéma `medical` séparé, `approval_workflows` / `approval_history`, `ai_reports` / `ai_report_sources`.
