-- =============================================================================
-- Migration 012 — Phase 3 (livraison 3) : projet de jeu et performance collective
-- Projet de jeu versionné (§9) : 5 moments pondérés (§27), principes,
-- sous-principes, comportements attendus, critères d'évaluation, exercices liés.
-- Systèmes et animations (§10). Évaluations collectives (§25-§27) : maîtrise
-- des principes, secteurs, relations intersectorielles, mesures de compacité
-- comparées à des objectifs paramétrables par situation (jamais imposés à
-- toutes les situations). La performance collective n'est jamais calculée à
-- partir des notes individuelles.
-- =============================================================================

-- ----------------------------------------------------------------- Projet de jeu
create table public.game_models (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade unique,
  name         text not null check (length(trim(name)) between 2 and 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.game_model_versions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  model_id      uuid not null references public.game_models(id) on delete cascade,
  version_no    smallint not null check (version_no >= 1),
  label         text not null check (length(trim(label)) between 2 and 120),
  notes         text check (length(notes) <= 2000),
  status        text not null default 'brouillon' check (status in ('brouillon', 'publie', 'archive')),
  published_at  timestamptz,
  published_by  uuid references auth.users(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (model_id, version_no)
);
create unique index game_model_versions_one_published on public.game_model_versions(model_id) where status = 'publie';
create unique index game_model_versions_one_draft on public.game_model_versions(model_id) where status = 'brouillon';

create table public.game_moments (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  version_id   uuid not null references public.game_model_versions(id) on delete cascade,
  code         text not null check (code in ('organisation_offensive', 'organisation_defensive', 'transition_offensive', 'transition_defensive', 'cpa')),
  label        text not null,
  description  text check (length(description) <= 2000),
  weight       numeric(5,2) not null check (weight >= 0 and weight <= 100),
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (version_id, code)
);

create table public.game_principles (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  version_id           uuid not null references public.game_model_versions(id) on delete cascade,
  moment_id            uuid not null references public.game_moments(id) on delete cascade,
  code                 text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  label                text not null check (length(trim(label)) between 2 and 120),
  description          text check (length(description) <= 2000),
  expected_behaviors   text check (length(expected_behaviors) <= 3000),
  evaluation_criteria  text check (length(evaluation_criteria) <= 3000),
  sort_order           smallint not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (version_id, code)
);
create index game_principles_version_idx on public.game_principles(version_id, moment_id, sort_order);

create table public.game_subprinciples (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  version_id    uuid not null references public.game_model_versions(id) on delete cascade,
  principle_id  uuid not null references public.game_principles(id) on delete cascade,
  label         text not null check (length(trim(label)) between 2 and 160),
  description   text check (length(description) <= 1000),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.game_principle_exercises (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  version_id    uuid not null references public.game_model_versions(id) on delete cascade,
  principle_id  uuid not null references public.game_principles(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (principle_id, exercise_id)
);

-- ----------------------------------------------------------------- Systèmes et animations
create table public.game_systems (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  parent_id     uuid references public.game_systems(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 80),
  base          text not null check (length(base) between 2 and 40),
  phase         text not null default 'reference' check (phase in ('reference', 'possession', 'hors_possession', 'transition_offensive', 'transition_defensive')),
  slots         jsonb not null check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) between 1 and 11),
  notes         text check (length(notes) <= 2000),
  is_reference  boolean not null default false,
  sort_order    smallint not null default 0,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((parent_id is null) = (phase = 'reference'))
);
create unique index game_systems_one_reference on public.game_systems(club_id) where is_reference;

-- ----------------------------------------------------------------- Évaluations collectives
create table public.collective_evaluations (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  season_id              uuid references public.seasons(id) on delete set null,
  game_model_version_id  uuid not null references public.game_model_versions(id) on delete restrict,
  context                text not null check (context in ('match', 'entrainement')),
  match_id               uuid references public.matches(id) on delete set null,
  training_session_id    uuid references public.training_sessions(id) on delete set null,
  system_id              uuid references public.game_systems(id) on delete set null,
  evaluated_on           date not null,
  title                  text not null check (length(trim(title)) between 2 and 160),
  notes                  text check (length(notes) <= 2000),
  status                 public.workflow_status not null default 'brouillon',
  validated_by           uuid references auth.users(id) on delete set null,
  validated_at           timestamptz,
  published_at           timestamptz,
  created_by             uuid references auth.users(id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (context <> 'match' or training_session_id is null),
  check (context <> 'entrainement' or match_id is null)
);
create index collective_evaluations_club_idx on public.collective_evaluations(club_id, evaluated_on desc);

-- unit_kind : principe (unit_code = code du principe, criterion_code = 'maitrise'),
-- secteur (§25) ou relation intersectorielle (§26). score null = N/E.
create table public.collective_scores (
  id                       uuid primary key default gen_random_uuid(),
  club_id                  uuid not null references public.clubs(id) on delete cascade,
  collective_evaluation_id uuid not null references public.collective_evaluations(id) on delete cascade,
  unit_kind                text not null check (unit_kind in ('principe', 'secteur', 'relation')),
  unit_code                text not null check (unit_code ~ '^[a-z0-9_]{2,60}$'),
  criterion_code           text not null check (criterion_code ~ '^[a-z0-9_]{2,60}$'),
  score                    smallint check (score between 1 and 5),
  fact                     text check (length(fact) <= 1000),
  interpretation           text check (length(interpretation) <= 1000),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (collective_evaluation_id, unit_kind, unit_code, criterion_code),
  check (unit_kind <> 'secteur' or (unit_code in ('gardiennes','defense','milieu','attaque','couloir_droit','couloir_gauche','axe_central')
         and criterion_code in ('coordination','complementarite','equilibre','communication','responsabilites'))),
  check (unit_kind <> 'relation' or (unit_code in ('gb_defense','defense_milieu','milieu_attaque','defense_attaque','laterale_ailiere','dc_sentinelle','sentinelle_relayeuse','n10_attaquante')
         and criterion_code in ('distances','connexions','synchronisation','compensations'))),
  check (unit_kind <> 'principe' or criterion_code = 'maitrise')
);

-- Objectifs de compacité : par situation et par relation, paramétrables (§26).
create table public.compactness_targets (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  situation      text not null check (situation in ('bloc_bas', 'bloc_median', 'bloc_haut', 'possession', 'transition')),
  relation_code  text not null check (relation_code in ('gb_defense','defense_milieu','milieu_attaque','defense_attaque')),
  min_m          numeric(4,1) not null check (min_m > 0),
  max_m          numeric(4,1) not null check (max_m > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (club_id, situation, relation_code),
  check (min_m <= max_m)
);

-- Distance mesurée entre deux lignes ; l'objectif en vigueur est copié (jamais réécrit après coup).
create table public.collective_measures (
  id                       uuid primary key default gen_random_uuid(),
  club_id                  uuid not null references public.clubs(id) on delete cascade,
  collective_evaluation_id uuid not null references public.collective_evaluations(id) on delete cascade,
  relation_code            text not null check (relation_code in ('gb_defense','defense_milieu','milieu_attaque','defense_attaque')),
  situation                text not null check (situation in ('bloc_bas', 'bloc_median', 'bloc_haut', 'possession', 'transition')),
  distance_m               numeric(4,1) not null check (distance_m > 0 and distance_m < 100),
  target_min               numeric(4,1),
  target_max               numeric(4,1),
  note                     text check (length(note) <= 500),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (collective_evaluation_id, relation_code, situation)
);

-- ----------------------------------------------------------------- Gardes
create or replace function app.guard_game_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
    raise exception 'Changement de version interdit.' using errcode = '23514';
  end if;
  select status into v_status from public.game_model_versions where id = coalesce(new.version_id, old.version_id);
  if v_status is not null and v_status <> 'brouillon' then
    raise exception 'Projet de jeu publié : il est figé. Créez une nouvelle version pour le modifier.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app.guard_game_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'brouillon' then
      raise exception 'Une version publiée ou archivée ne se supprime pas.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'archive' and new.status <> 'archive' then
    raise exception 'Version archivée : elle ne peut pas être republiée.' using errcode = '42501';
  end if;
  if old.status <> 'brouillon' and (new.label, new.notes, new.version_no, new.model_id)
       is distinct from (old.label, old.notes, old.version_no, old.model_id) then
    raise exception 'Projet de jeu publié : il est figé.' using errcode = '42501';
  end if;
  if new.status = 'brouillon' and old.status <> 'brouillon' then
    raise exception 'Une version publiée ne repasse pas en brouillon.' using errcode = '42501';
  end if;
  if new.status = 'publie' and old.status <> 'publie' then
    new.published_at := now();
    new.published_by := (select auth.uid());
  end if;
  return new;
end;
$$;

-- Cohérence des liens (même version, même club).
create or replace function app.guard_game_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'game_principles' then
    if not exists (select 1 from public.game_moments m where m.id = new.moment_id and m.version_id = new.version_id) then
      raise exception 'Moment d''une autre version.' using errcode = '23514';
    end if;
  elsif tg_table_name in ('game_subprinciples', 'game_principle_exercises') then
    if not exists (select 1 from public.game_principles p where p.id = new.principle_id and p.version_id = new.version_id) then
      raise exception 'Principe d''une autre version.' using errcode = '23514';
    end if;
    if tg_table_name = 'game_principle_exercises'
       and not exists (select 1 from public.exercises e where e.id = new.exercise_id and e.club_id = new.club_id) then
      raise exception 'Exercice d''un autre club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'game_systems' then
    if new.parent_id is not null and not exists (select 1 from public.game_systems s where s.id = new.parent_id and s.club_id = new.club_id and s.parent_id is null) then
      raise exception 'Une animation se rattache à un système de référence du club.' using errcode = '23514';
    end if;
    if new.is_reference and new.parent_id is not null then
      raise exception 'Seul un système de référence peut être le système du club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'collective_evaluations' then
    if not exists (select 1 from public.game_model_versions v where v.id = new.game_model_version_id and v.club_id = new.club_id
                   and (v.status = 'publie' or (tg_op = 'UPDATE' and new.game_model_version_id = old.game_model_version_id))) then
      raise exception 'Le projet de jeu choisi n''est pas publié.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.game_model_version_id <> old.game_model_version_id
       and exists (select 1 from public.collective_scores where collective_evaluation_id = new.id) then
      raise exception 'Des principes sont déjà notés avec cette version.' using errcode = '23514';
    end if;
    if new.match_id is not null and not exists (select 1 from public.matches m where m.id = new.match_id and m.club_id = new.club_id) then
      raise exception 'Match d''un autre club.' using errcode = '23514';
    end if;
    if new.training_session_id is not null and not exists (select 1 from public.training_sessions t where t.id = new.training_session_id and t.club_id = new.club_id) then
      raise exception 'Séance d''un autre club.' using errcode = '23514';
    end if;
    if new.system_id is not null and not exists (select 1 from public.game_systems s where s.id = new.system_id and s.club_id = new.club_id) then
      raise exception 'Système d''un autre club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'collective_scores' then
    if not exists (select 1 from public.collective_evaluations e where e.id = new.collective_evaluation_id and e.club_id = new.club_id) then
      raise exception 'Évaluation incohérente (club).' using errcode = '23514';
    end if;
    if new.unit_kind = 'principe' and not exists (
      select 1 from public.collective_evaluations e join public.game_principles p on p.version_id = e.game_model_version_id
      where e.id = new.collective_evaluation_id and p.code = new.unit_code) then
      raise exception 'Principe hors du projet de jeu de cette évaluation.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Copie de l'objectif de compacité en vigueur au moment de la mesure.
create or replace function app.compute_collective_measure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.compactness_targets;
  v_status text;
begin
  if not exists (select 1 from public.collective_evaluations e where e.id = new.collective_evaluation_id and e.club_id = new.club_id) then
    raise exception 'Évaluation incohérente (club).' using errcode = '23514';
  end if;
  select status::text into v_status from public.collective_evaluations where id = new.collective_evaluation_id;
  if tg_op = 'INSERT' or v_status in ('brouillon', 'soumis') then
    select * into t from public.compactness_targets
    where club_id = new.club_id and situation = new.situation and relation_code = new.relation_code;
    new.target_min := t.min_m;
    new.target_max := t.max_m;
  else
    new.target_min := old.target_min;
    new.target_max := old.target_max;
  end if;
  return new;
end;
$$;

-- Contenu d'une évaluation collective validée : modifiable seulement par evaluations.validate.
create or replace function app.guard_collective_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  select status::text, club_id into v_status, v_club from public.collective_evaluations
  where id = coalesce(new.collective_evaluation_id, old.collective_evaluation_id);
  if (select auth.uid()) is not null and v_status in ('valide', 'publie', 'archive')
     and not app.has_permission(v_club, 'evaluations.validate') then
    raise exception 'Évaluation collective validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app.notify_collective()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'valide' and (tg_op = 'INSERT' or old.status is distinct from 'valide') then
    perform app.notify_staff(new.club_id, 'evaluation', 'Évaluation collective validée', new.title,
                             '/performance/collective/' || new.id);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------- Triggers, RLS
do $$
declare t text;
begin
  foreach t in array array['game_models','game_model_versions','game_moments','game_principles','game_subprinciples',
                           'game_principle_exercises','game_systems','collective_evaluations','collective_scores',
                           'compactness_targets','collective_measures'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'evaluations.read'))$f$, t);
  end loop;

  foreach t in array array['game_models','game_model_versions','game_moments','game_principles','game_subprinciples',
                           'game_principle_exercises','game_systems','compactness_targets'] loop
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'frameworks.manage')) with check (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
  end loop;

  foreach t in array array['collective_evaluations','collective_scores','collective_measures'] loop
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'evaluations.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))
      with check (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))$f$, t);
  end loop;

  foreach t in array array['game_moments','game_principles','game_subprinciples','game_principle_exercises'] loop
    execute format('create trigger trg_%1$s_guard before insert or update or delete on public.%1$I
                      for each row execute function app.guard_game_children()', t);
  end loop;
  foreach t in array array['game_principles','game_subprinciples','game_principle_exercises','game_systems','collective_evaluations','collective_scores'] loop
    execute format('create trigger trg_%1$s_consistency before insert or update on public.%1$I
                      for each row execute function app.guard_game_consistency()', t);
  end loop;
  foreach t in array array['collective_scores','collective_measures'] loop
    execute format('create trigger trg_%1$s_lock before insert or update or delete on public.%1$I
                      for each row execute function app.guard_collective_children()', t);
  end loop;
end $$;

create policy collective_evaluations_delete on public.collective_evaluations for delete to authenticated
  using ((app.has_permission(club_id, 'evaluations.write') and status in ('brouillon', 'soumis'))
         or app.has_permission(club_id, 'evaluations.validate'));
create policy collective_scores_delete on public.collective_scores for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));
create policy collective_measures_delete on public.collective_measures for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));

create trigger trg_game_model_versions_guard before update or delete on public.game_model_versions
  for each row execute function app.guard_game_version();
create trigger trg_collective_measures_compute before insert or update on public.collective_measures
  for each row execute function app.compute_collective_measure();
create trigger trg_collective_evaluations_workflow before insert or update on public.collective_evaluations
  for each row execute function app.guard_workflow('evaluations.validate');
create trigger trg_collective_evaluations_history after insert or update on public.collective_evaluations
  for each row execute function app.track_status();
create trigger trg_collective_evaluations_notify after insert or update on public.collective_evaluations
  for each row execute function app.notify_collective();

-- ----------------------------------------------------------------- Nouvelle version / publication
create or replace function public.clone_game_model_version(p_version uuid, p_label text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.game_model_versions;
  v_new uuid;
  v_no smallint;
begin
  select * into v_src from public.game_model_versions where id = p_version;
  if v_src.id is null then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if not app.has_permission(v_src.club_id, 'frameworks.manage') then
    raise exception 'Gestion du projet de jeu réservée.' using errcode = '42501';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_no from public.game_model_versions where model_id = v_src.model_id;
  insert into public.game_model_versions (club_id, model_id, version_no, label, notes, created_by)
  values (v_src.club_id, v_src.model_id, v_no, coalesce(nullif(trim(p_label), ''), 'Version ' || v_no),
          'Copie de la version ' || v_src.version_no, (select auth.uid()))
  returning id into v_new;

  insert into public.game_moments (club_id, version_id, code, label, description, weight, sort_order)
  select club_id, v_new, code, label, description, weight, sort_order from public.game_moments where version_id = p_version;

  insert into public.game_principles (club_id, version_id, moment_id, code, label, description, expected_behaviors, evaluation_criteria, sort_order)
  select s.club_id, v_new, nm.id, s.code, s.label, s.description, s.expected_behaviors, s.evaluation_criteria, s.sort_order
  from public.game_principles s
  join public.game_moments om on om.id = s.moment_id
  join public.game_moments nm on nm.version_id = v_new and nm.code = om.code
  where s.version_id = p_version;

  insert into public.game_subprinciples (club_id, version_id, principle_id, label, description, sort_order)
  select s.club_id, v_new, np.id, s.label, s.description, s.sort_order
  from public.game_subprinciples s
  join public.game_principles op on op.id = s.principle_id
  join public.game_principles np on np.version_id = v_new and np.code = op.code
  where s.version_id = p_version;

  insert into public.game_principle_exercises (club_id, version_id, principle_id, exercise_id)
  select s.club_id, v_new, np.id, s.exercise_id
  from public.game_principle_exercises s
  join public.game_principles op on op.id = s.principle_id
  join public.game_principles np on np.version_id = v_new and np.code = op.code
  where s.version_id = p_version;

  return v_new;
end;
$$;
revoke all on function public.clone_game_model_version(uuid, text) from public, anon;
grant execute on function public.clone_game_model_version(uuid, text) to authenticated;

create or replace function public.publish_game_model_version(p_version uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.game_model_versions;
  v_total numeric;
  v_empty text;
begin
  select * into v from public.game_model_versions where id = p_version;
  if v.id is null then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if not app.has_permission(v.club_id, 'frameworks.manage') then
    raise exception 'Gestion du projet de jeu réservée.' using errcode = '42501';
  end if;
  if v.status <> 'brouillon' then raise exception 'Seul un brouillon peut être publié.' using errcode = '23514'; end if;
  select coalesce(sum(weight), 0) into v_total from public.game_moments where version_id = p_version;
  if v_total <> 100 then
    raise exception 'Pondérations des moments du jeu : total % %% au lieu de 100 %%.', v_total using errcode = '23514';
  end if;
  select m.label into v_empty from public.game_moments m
  where m.version_id = p_version and m.weight > 0
    and not exists (select 1 from public.game_principles p where p.moment_id = m.id)
  limit 1;
  if v_empty is not null then
    raise exception 'Le moment « % » n''a aucun principe.', v_empty using errcode = '23514';
  end if;
  update public.game_model_versions set status = 'archive' where model_id = v.model_id and status = 'publie';
  update public.game_model_versions set status = 'publie' where id = p_version;
end;
$$;
revoke all on function public.publish_game_model_version(uuid) from public, anon;
grant execute on function public.publish_game_model_version(uuid) to authenticated;

-- ----------------------------------------------------------------- Projet de jeu initial (§9, §26, §27)
create or replace function app.seed_game_model(p_club uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model uuid;
  v_ver uuid;
  m record;
  p record;
  i int := 0;
begin
  if exists (select 1 from public.game_models where club_id = p_club) then return null; end if;
  insert into public.game_models (club_id, name) values (p_club, 'Projet de jeu') returning id into v_model;
  insert into public.game_model_versions (club_id, model_id, version_no, label, notes)
  values (p_club, v_model, 1, 'Version 1 — cahier des charges', 'Moments, principes et pondérations du cahier des charges. Sous-principes, comportements attendus et exercices à compléter par le staff.')
  returning id into v_ver;

  for m in select * from (values
    (1, 'organisation_offensive', 'Organisation offensive', 25),
    (2, 'organisation_defensive', 'Organisation défensive', 30),
    (3, 'transition_offensive', 'Transition offensive', 15),
    (4, 'transition_defensive', 'Transition défensive', 20),
    (5, 'cpa', 'Coups de pied arrêtés', 10)
  ) as t(ord, code, label, w) loop
    insert into public.game_moments (club_id, version_id, code, label, weight, sort_order)
    values (p_club, v_ver, m.code, m.label, m.w, m.ord);
  end loop;

  for p in select * from (values
    ('organisation_offensive','oo_construction','Construction'), ('organisation_offensive','oo_relance','Relance'),
    ('organisation_offensive','oo_progression','Progression'), ('organisation_offensive','oo_largeur','Largeur'),
    ('organisation_offensive','oo_profondeur','Profondeur'), ('organisation_offensive','oo_mobilite','Mobilité'),
    ('organisation_offensive','oo_fixation','Fixation'), ('organisation_offensive','oo_desequilibre','Déséquilibre'),
    ('organisation_offensive','oo_combinaisons','Combinaisons'), ('organisation_offensive','oo_finition','Finition'),
    ('organisation_defensive','od_defendre_a_onze','Défendre à onze'), ('organisation_defensive','od_protection_axe','Protection de l''axe'),
    ('organisation_defensive','od_compacite','Compacité'), ('organisation_defensive','od_cadrage','Cadrage du porteur'),
    ('organisation_defensive','od_couverture','Couverture'), ('organisation_defensive','od_equilibre','Équilibre'),
    ('organisation_defensive','od_profondeur','Gestion de la profondeur'), ('organisation_defensive','od_alignement','Alignement défensif'),
    ('organisation_defensive','od_pressing','Pressing'), ('organisation_defensive','od_defense_surface','Défense de la surface'),
    ('transition_offensive','to_reaction','Réaction à la récupération'), ('transition_offensive','to_prise_information','Prise d''information'),
    ('transition_offensive','to_premiere_passe','Première passe'), ('transition_offensive','to_projection','Projection'),
    ('transition_offensive','to_desequilibre','Exploitation du déséquilibre'), ('transition_offensive','to_espaces','Attaque des espaces libres'),
    ('transition_offensive','to_securisation','Sécurisation de la possession'),
    ('transition_defensive','td_reaction','Réaction à la perte'), ('transition_defensive','td_contre_pressing','Contre-pressing'),
    ('transition_defensive','td_protection_axe','Protection de l''axe'), ('transition_defensive','td_repli','Repli'),
    ('transition_defensive','td_compensation','Compensation'), ('transition_defensive','td_reorganisation','Réorganisation du bloc'),
    ('cpa','cpa_corners_off','Corners offensifs'), ('cpa','cpa_corners_def','Corners défensifs'),
    ('cpa','cpa_coups_francs_off','Coups francs offensifs'), ('cpa','cpa_coups_francs_def','Coups francs défensifs'),
    ('cpa','cpa_penalties','Penalties'), ('cpa','cpa_touches','Touches'),
    ('cpa','cpa_combinaisons','Combinaisons'), ('cpa','cpa_responsabilites','Responsabilités individuelles')
  ) as t(moment, code, label) loop
    i := i + 1;
    insert into public.game_principles (club_id, version_id, moment_id, code, label, sort_order)
    select p_club, v_ver, gm.id, p.code, p.label, i
    from public.game_moments gm where gm.version_id = v_ver and gm.code = p.moment;
  end loop;

  update public.game_model_versions set status = 'publie', published_at = now() where id = v_ver;

  -- Référence initiale de compacité : 10 à 15 m entre les lignes en bloc défensif (§26).
  insert into public.compactness_targets (club_id, situation, relation_code, min_m, max_m)
  values (p_club, 'bloc_median', 'defense_milieu', 10, 15), (p_club, 'bloc_median', 'milieu_attaque', 10, 15),
         (p_club, 'bloc_bas', 'defense_milieu', 10, 15), (p_club, 'bloc_bas', 'milieu_attaque', 10, 15)
  on conflict (club_id, situation, relation_code) do nothing;
  return v_ver;
end;
$$;
revoke all on function app.seed_game_model(uuid) from public, authenticated;

create or replace function app.on_club_created_seed_game_model()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.seed_game_model(new.id);
  return new;
end;
$$;
create trigger trg_clubs_seed_game_model after insert on public.clubs
  for each row execute function app.on_club_created_seed_game_model();

select app.seed_game_model(id) from public.clubs;
