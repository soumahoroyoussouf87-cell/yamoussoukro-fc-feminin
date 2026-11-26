-- =============================================================================
-- Migration 003 — Données de référence : rôles, permissions, matrice, postes
-- (données de structure, pas de données sportives fictives)
-- =============================================================================

insert into public.roles (code, label, description, is_staff, sort_order) values
  ('admin',              'Administrateur',          'Gestion des comptes, rôles, paramètres et sauvegardes. N''accède pas aux dossiers médicaux.', true, 10),
  ('sporting_director',  'Direction sportive',      'Supervision de l''ensemble du secteur sportif, validations finales.', true, 20),
  ('head_coach',         'Entraîneur principal',    'Responsable du projet de jeu, des compositions et des validations sportives.', true, 30),
  ('assistant_coach',    'Entraîneur adjoint',      'Planification, séances, évaluations ; propose les compositions.', true, 40),
  ('goalkeeper_coach',   'Entraîneur des gardiennes','Séances et évaluations spécifiques aux gardiennes.', true, 50),
  ('video_analyst',      'Analyste vidéo',          'Import, codification et diffusion contrôlée des séquences vidéo.', true, 60),
  ('fitness_coach',      'Préparateur athlétique',  'Tests physiques, charges, GPS, récupération.', true, 70),
  ('medical_staff',      'Staff médical',           'Seul rôle ayant accès aux dossiers médicaux.', true, 80),
  ('team_manager',       'Team Manager',            'Administration de l''effectif, documents, logistique et délégations.', true, 90),
  ('kit_manager',        'Intendant',               'Matériel, équipements, logistique des déplacements.', true, 100),
  ('communication',      'Responsable communication','Accès aux informations publiables uniquement.', true, 110),
  ('player',             'Joueuse',                 'Portail personnel : uniquement ses propres données validées.', false, 200);

insert into public.permissions (code, module, label, is_sensitive, phase) values
  -- Pilotage
  ('dashboard.read',             'pilotage',      'Consulter le tableau de bord', false, 1),
  -- Management
  ('players.read',               'effectif',      'Consulter l''effectif', false, 1),
  ('players.write',              'effectif',      'Créer et modifier les fiches joueuses', false, 1),
  ('players.delete',             'effectif',      'Archiver ou supprimer une joueuse', true, 1),
  ('players.documents.read',     'effectif',      'Consulter les documents administratifs', true, 1),
  ('players.documents.write',    'effectif',      'Déposer et supprimer des documents administratifs', true, 1),
  ('availability.read',          'effectif',      'Consulter la disponibilité sportive', false, 1),
  ('availability.write',         'effectif',      'Déclarer la disponibilité sportive', false, 1),
  ('staff.read',                 'staff',         'Consulter le staff', false, 1),
  ('staff.write',                'staff',         'Gérer les fiches du staff', false, 1),
  -- Compétition / planification (écrans en Phase 2)
  ('matches.read',               'competition',   'Consulter les rencontres', false, 1),
  ('matches.write',              'competition',   'Gérer les rencontres', false, 1),
  ('planning.read',              'planification', 'Consulter la planification et les séances', false, 2),
  ('planning.write',             'planification', 'Gérer la planification et les séances', false, 2),
  ('lineups.read_draft',         'competition',   'Voir les compositions provisoires (confidentiel)', true, 2),
  ('lineups.write',              'competition',   'Préparer les compositions', true, 2),
  ('lineups.validate',           'competition',   'Valider officiellement une composition', true, 2),
  ('delegations.write',          'competition',   'Gérer les délégations', false, 2),
  -- Performance
  ('evaluations.read',           'performance',   'Consulter les évaluations', false, 3),
  ('evaluations.write',          'performance',   'Saisir des évaluations', false, 3),
  ('evaluations.validate',       'performance',   'Valider et publier les évaluations', false, 3),
  ('frameworks.manage',          'performance',   'Gérer les référentiels et pondérations', false, 3),
  -- Vidéo et développement
  ('video.read',                 'video',         'Consulter la vidéothèque staff', false, 4),
  ('video.write',                'video',         'Importer et codifier des vidéos', false, 4),
  ('video.share',                'video',         'Partager des clips avec des joueuses', false, 4),
  ('development.read',           'developpement', 'Consulter les plans de développement', false, 4),
  ('development.write',          'developpement', 'Gérer les plans de développement', false, 4),
  -- Sport science et médical
  ('sportscience.read',          'sport_science', 'Consulter tests physiques, charges et GPS', false, 5),
  ('sportscience.write',         'sport_science', 'Saisir tests physiques, charges et GPS', false, 5),
  ('medical.read',               'medical',       'Consulter les dossiers médicaux', true, 5),
  ('medical.write',              'medical',       'Gérer les dossiers médicaux', true, 5),
  -- Intelligence et rapports
  ('ai.use',                     'ia',            'Utiliser YFC PERFORMANCE AI', false, 6),
  ('reports.read',               'rapports',      'Consulter les rapports', false, 1),
  ('reports.write',              'rapports',      'Générer et publier des rapports', false, 3),
  -- Administration
  ('users.manage',               'administration','Gérer les comptes et attribuer les rôles', true, 1),
  ('roles.read',                 'administration','Consulter la matrice des rôles', false, 1),
  ('audit.read',                 'administration','Consulter le journal d''activité', true, 1),
  ('settings.manage',            'administration','Gérer club, saisons, compétitions et paramètres', false, 1),
  ('backups.manage',             'administration','Gérer les sauvegardes et restaurations', true, 1);

-- Matrice rôle → permissions
with matrix(role_code, perms) as (values
  ('admin', array[
    'dashboard.read','players.read','players.write','players.delete','players.documents.read','players.documents.write',
    'availability.read','staff.read','staff.write','matches.read','matches.write','planning.read','reports.read',
    'users.manage','roles.read','audit.read','settings.manage','backups.manage']),
  ('sporting_director', array[
    'dashboard.read','players.read','players.write','players.delete','players.documents.read','availability.read',
    'staff.read','staff.write','matches.read','matches.write','planning.read','lineups.read_draft','lineups.validate',
    'delegations.write','evaluations.read','evaluations.validate','frameworks.manage','video.read','development.read',
    'sportscience.read','ai.use','reports.read','reports.write','roles.read','audit.read','settings.manage']),
  ('head_coach', array[
    'dashboard.read','players.read','players.write','availability.read','availability.write','staff.read','matches.read','matches.write',
    'planning.read','planning.write','lineups.read_draft','lineups.write','lineups.validate','delegations.write',
    'evaluations.read','evaluations.write','evaluations.validate','frameworks.manage','video.read','video.write',
    'video.share','development.read','development.write','sportscience.read','ai.use','reports.read','reports.write','roles.read']),
  ('assistant_coach', array[
    'dashboard.read','players.read','availability.read','staff.read','matches.read','matches.write','planning.read',
    'planning.write','lineups.read_draft','lineups.write','evaluations.read','evaluations.write','video.read',
    'video.write','development.read','development.write','sportscience.read','ai.use','reports.read','reports.write']),
  ('goalkeeper_coach', array[
    'dashboard.read','players.read','availability.read','staff.read','matches.read','planning.read','planning.write',
    'lineups.read_draft','evaluations.read','evaluations.write','video.read','development.read','development.write',
    'sportscience.read','reports.read']),
  ('video_analyst', array[
    'dashboard.read','players.read','availability.read','staff.read','matches.read','planning.read','evaluations.read',
    'evaluations.write','video.read','video.write','video.share','development.read','reports.read','reports.write']),
  ('fitness_coach', array[
    'dashboard.read','players.read','availability.read','availability.write','staff.read','matches.read','planning.read',
    'planning.write','evaluations.read','evaluations.write','development.read','sportscience.read','sportscience.write',
    'reports.read','reports.write']),
  ('medical_staff', array[
    'dashboard.read','players.read','availability.read','availability.write','staff.read','matches.read','planning.read',
    'sportscience.read','medical.read','medical.write','reports.read']),
  ('team_manager', array[
    'dashboard.read','players.read','players.write','players.documents.read','players.documents.write','availability.read',
    'availability.write','staff.read','staff.write','matches.read','matches.write','planning.read','delegations.write','reports.read']),
  ('kit_manager', array['dashboard.read','players.read','staff.read','matches.read','planning.read']),
  ('communication', array['dashboard.read','players.read','staff.read','matches.read']),
  ('player', array[]::text[])
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.code = m.role_code
cross join lateral unnest(m.perms) as perm(code)
join public.permissions p on p.code = perm.code;

-- Postes (clé framework_key = ligne du tableau de pondérations du cahier des charges)
insert into public.positions (code, label, line, framework_key, sort_order) values
  ('GB',  'Gardienne',              'gardienne', 'GB',     1),
  ('DC',  'Défenseure centrale',    'defense',   'DC',     2),
  ('DD',  'Latérale droite',        'defense',   'DD_DG',  3),
  ('DG',  'Latérale gauche',        'defense',   'DD_DG',  4),
  ('PD',  'Piston droit',           'defense',   'PISTON', 5),
  ('PG',  'Piston gauche',          'defense',   'PISTON', 6),
  ('N6',  'Sentinelle — N°6',       'milieu',    'N6',     7),
  ('N8',  'Relayeuse — N°8',        'milieu',    'N8',     8),
  ('N10', 'Milieu offensive — N°10','milieu',    'N10',    9),
  ('AD',  'Ailière droite',         'attaque',   'AILIERE',10),
  ('AG',  'Ailière gauche',         'attaque',   'AILIERE',11),
  ('N9',  'Attaquante — N°9',       'attaque',   'N9',     12);
