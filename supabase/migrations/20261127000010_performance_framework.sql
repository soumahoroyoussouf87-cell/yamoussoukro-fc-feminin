-- =============================================================================
-- Migration 010 — Phase 3 (livraison 1) : Performance Framework
-- Référentiels versionnés (dimensions, critères, pondérations par poste),
-- séances d'évaluation, évaluations individuelles et notes 1-5 / N/E.
-- Un référentiel publié est figé : toute modification passe par une nouvelle
-- version, sans réécrire l'historique (cahier des charges §19, §28, règle 13).
-- Aucune donnée sportive fictive : seuls les référentiels du cahier des
-- charges sont chargés.
-- =============================================================================

-- ----------------------------------------------------------------- Référentiels
create table public.evaluation_frameworks (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  kind         text not null default 'individuel' check (kind in ('individuel')),
  name         text not null check (length(trim(name)) between 2 and 120),
  description  text check (length(description) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, kind)
);

create table public.framework_versions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  framework_id  uuid not null references public.evaluation_frameworks(id) on delete cascade,
  version_no    smallint not null check (version_no >= 1),
  label         text not null check (length(trim(label)) between 2 and 120),
  notes         text check (length(notes) <= 2000),
  status        text not null default 'brouillon' check (status in ('brouillon', 'publie', 'archive')),
  published_at  timestamptz,
  published_by  uuid references auth.users(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (framework_id, version_no)
);
create unique index framework_versions_one_published on public.framework_versions(framework_id) where status = 'publie';
create unique index framework_versions_one_draft on public.framework_versions(framework_id) where status = 'brouillon';

create table public.evaluation_dimensions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  version_id   uuid not null references public.framework_versions(id) on delete cascade,
  code         text not null check (code in ('technique', 'tactique', 'athletique', 'cognitive', 'mentale', 'comportementale')),
  label        text not null,
  description  text check (length(description) <= 2000),
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (version_id, code)
);

-- default_weight : poids appliqué à tous les postes (null = critère réservé aux
-- postes qui ont une pondération explicite dans position_criteria_weights).
create table public.evaluation_criteria (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  version_id      uuid not null references public.framework_versions(id) on delete cascade,
  dimension_id    uuid not null references public.evaluation_dimensions(id) on delete cascade,
  code            text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  label           text not null check (length(trim(label)) between 2 and 120),
  description     text check (length(description) <= 1000),
  default_weight  numeric(6,2) check (default_weight >= 0 and default_weight <= 100),
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (version_id, code)
);
create index evaluation_criteria_version_idx on public.evaluation_criteria(version_id, dimension_id, sort_order);

create table public.position_criteria_weights (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  version_id     uuid not null references public.framework_versions(id) on delete cascade,
  criterion_id   uuid not null references public.evaluation_criteria(id) on delete cascade,
  framework_key  text not null check (framework_key in ('GB','DC','DD_DG','N6','N8','N10','AILIERE','N9','PISTON')),
  weight         numeric(6,2) not null check (weight >= 0 and weight <= 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (criterion_id, framework_key)
);
create index position_criteria_weights_version_idx on public.position_criteria_weights(version_id, framework_key);

create table public.position_dimension_weights (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  version_id     uuid not null references public.framework_versions(id) on delete cascade,
  framework_key  text not null check (framework_key in ('GB','DC','DD_DG','N6','N8','N10','AILIERE','N9','PISTON')),
  dimension_code text not null check (dimension_code in ('technique', 'tactique', 'athletique', 'cognitive', 'mentale', 'comportementale')),
  weight         numeric(6,2) not null check (weight >= 0 and weight <= 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (version_id, framework_key, dimension_code)
);

-- ----------------------------------------------------------------- Évaluations
create table public.evaluation_sessions (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  season_id             uuid references public.seasons(id) on delete set null,
  framework_version_id  uuid not null references public.framework_versions(id) on delete restrict,
  context               text not null check (context in ('match', 'entrainement')),
  match_id              uuid references public.matches(id) on delete set null,
  training_session_id   uuid references public.training_sessions(id) on delete set null,
  evaluated_on          date not null,
  title                 text not null check (length(trim(title)) between 2 and 160),
  notes                 text check (length(notes) <= 2000),
  status                public.workflow_status not null default 'brouillon',
  validated_by          uuid references auth.users(id) on delete set null,
  validated_at          timestamptz,
  published_at          timestamptz,
  created_by            uuid references auth.users(id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (context <> 'match' or training_session_id is null),
  check (context <> 'entrainement' or match_id is null)
);
create index evaluation_sessions_club_idx on public.evaluation_sessions(club_id, evaluated_on desc);

create table public.individual_evaluations (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  evaluation_session_id  uuid not null references public.evaluation_sessions(id) on delete cascade,
  player_id              uuid not null references public.players(id) on delete cascade,
  position_id            uuid references public.positions(id) on delete set null,
  framework_key          text not null check (framework_key in ('GB','DC','DD_DG','N6','N8','N10','AILIERE','N9','PISTON')),
  minutes_played         smallint check (minutes_played between 0 and 300),
  comment                text check (length(comment) <= 2000),
  evaluator_id           uuid references auth.users(id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (evaluation_session_id, player_id)
);
create index individual_evaluations_player_idx on public.individual_evaluations(player_id);

-- score null = N/E explicite : exclu du numérateur et du dénominateur.
create table public.evaluation_scores (
  id                        uuid primary key default gen_random_uuid(),
  club_id                   uuid not null references public.clubs(id) on delete cascade,
  individual_evaluation_id  uuid not null references public.individual_evaluations(id) on delete cascade,
  criterion_id              uuid not null references public.evaluation_criteria(id) on delete restrict,
  score                     smallint check (score between 1 and 5),
  fact                      text check (length(fact) <= 1000),
  interpretation            text check (length(interpretation) <= 1000),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (individual_evaluation_id, criterion_id)
);
create index evaluation_scores_criterion_idx on public.evaluation_scores(criterion_id);

create table public.evaluation_evidence (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  evaluation_score_id  uuid not null references public.evaluation_scores(id) on delete cascade,
  url                  text not null check (url ~ '^https://' and length(url) <= 500),
  note                 text check (length(note) <= 300),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------- Gardes
-- Référentiel figé dès qu'il n'est plus en brouillon.
create or replace function app.guard_framework_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_version uuid := coalesce(new.version_id, old.version_id);
begin
  if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
    raise exception 'Changement de version interdit.' using errcode = '23514';
  end if;
  select status into v_status from public.framework_versions where id = v_version;
  if v_status is not null and v_status <> 'brouillon' then
    raise exception 'Référentiel publié : il est figé. Créez une nouvelle version pour le modifier.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app.guard_framework_version()
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
  if tg_op = 'UPDATE' then
    if old.status = 'archive' and new.status <> 'archive' then
      raise exception 'Version archivée : elle ne peut pas être republiée.' using errcode = '42501';
    end if;
    if old.status <> 'brouillon' and (new.label, new.notes, new.version_no, new.framework_id)
         is distinct from (old.label, old.notes, old.version_no, old.framework_id) then
      raise exception 'Référentiel publié : il est figé.' using errcode = '42501';
    end if;
    if new.status = 'publie' and old.status <> 'publie' then
      new.published_at := now();
      new.published_by := (select auth.uid());
    end if;
    if new.status = 'brouillon' and old.status <> 'brouillon' then
      raise exception 'Une version publiée ne repasse pas en brouillon.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Contenu d'une évaluation validée : modifiable seulement par evaluations.validate.
create or replace function app.guard_evaluation_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
  v_session uuid;
begin
  if tg_table_name = 'individual_evaluations' then
    v_session := coalesce(new.evaluation_session_id, old.evaluation_session_id);
  elsif tg_table_name = 'evaluation_scores' then
    select ie.evaluation_session_id into v_session from public.individual_evaluations ie
    where ie.id = coalesce(new.individual_evaluation_id, old.individual_evaluation_id);
  else
    select ie.evaluation_session_id into v_session
    from public.evaluation_scores s join public.individual_evaluations ie on ie.id = s.individual_evaluation_id
    where s.id = coalesce(new.evaluation_score_id, old.evaluation_score_id);
  end if;
  select status::text, club_id into v_status, v_club from public.evaluation_sessions where id = v_session;
  if (select auth.uid()) is not null and v_status in ('valide', 'publie', 'archive')
     and not app.has_permission(v_club, 'evaluations.validate') then
    raise exception 'Évaluation validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Cohérence : version publiée, même club, critère de la bonne version.
create or replace function app.guard_evaluation_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'evaluation_sessions' then
    if not exists (select 1 from public.framework_versions v where v.id = new.framework_version_id and v.club_id = new.club_id
                   and (v.status = 'publie' or (tg_op = 'UPDATE' and new.framework_version_id = old.framework_version_id))) then
      raise exception 'Le référentiel choisi n''est pas publié.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.framework_version_id <> old.framework_version_id
       and exists (select 1 from public.individual_evaluations where evaluation_session_id = new.id) then
      raise exception 'Des joueuses sont déjà évaluées avec ce référentiel.' using errcode = '23514';
    end if;
    if new.match_id is not null and not exists (select 1 from public.matches m where m.id = new.match_id and m.club_id = new.club_id) then
      raise exception 'Match d''un autre club.' using errcode = '23514';
    end if;
    if new.training_session_id is not null and not exists (select 1 from public.training_sessions t where t.id = new.training_session_id and t.club_id = new.club_id) then
      raise exception 'Séance d''un autre club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'individual_evaluations' then
    if not exists (select 1 from public.evaluation_sessions s where s.id = new.evaluation_session_id and s.club_id = new.club_id)
       or not exists (select 1 from public.players p where p.id = new.player_id and p.club_id = new.club_id) then
      raise exception 'Évaluation incohérente (club).' using errcode = '23514';
    end if;
  elsif tg_table_name = 'evaluation_scores' then
    if not exists (
      select 1 from public.individual_evaluations ie
      join public.evaluation_sessions s on s.id = ie.evaluation_session_id
      join public.evaluation_criteria c on c.version_id = s.framework_version_id
      where ie.id = new.individual_evaluation_id and c.id = new.criterion_id and ie.club_id = new.club_id
    ) then
      raise exception 'Critère hors du référentiel de cette évaluation.' using errcode = '23514';
    end if;
  elsif tg_table_name in ('evaluation_criteria') then
    if not exists (select 1 from public.evaluation_dimensions d where d.id = new.dimension_id and d.version_id = new.version_id) then
      raise exception 'Dimension d''une autre version.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'position_criteria_weights' then
    if not exists (select 1 from public.evaluation_criteria c where c.id = new.criterion_id and c.version_id = new.version_id) then
      raise exception 'Critère d''une autre version.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------- Triggers, RLS
do $$
declare t text;
begin
  foreach t in array array['evaluation_frameworks','framework_versions','evaluation_dimensions','evaluation_criteria',
                           'position_criteria_weights','position_dimension_weights','evaluation_sessions',
                           'individual_evaluations','evaluation_scores','evaluation_evidence'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'evaluations.read'))$f$, t);
  end loop;

  foreach t in array array['evaluation_frameworks','framework_versions','evaluation_dimensions','evaluation_criteria',
                           'position_criteria_weights','position_dimension_weights'] loop
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'frameworks.manage')) with check (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'frameworks.manage'))$f$, t);
  end loop;

  foreach t in array array['evaluation_sessions','individual_evaluations','evaluation_scores','evaluation_evidence'] loop
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'evaluations.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))
      with check (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))$f$, t);
  end loop;
end $$;

-- Suppression d'une séance d'évaluation : brouillon/soumise par l'auteur des saisies, sinon validation requise.
create policy evaluation_sessions_delete on public.evaluation_sessions for delete to authenticated
  using ((app.has_permission(club_id, 'evaluations.write') and status in ('brouillon', 'soumis'))
         or app.has_permission(club_id, 'evaluations.validate'));
create policy individual_evaluations_delete on public.individual_evaluations for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));
create policy evaluation_scores_delete on public.evaluation_scores for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));
create policy evaluation_evidence_delete on public.evaluation_evidence for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));

create trigger trg_framework_versions_guard before update or delete on public.framework_versions
  for each row execute function app.guard_framework_version();
create trigger trg_evaluation_dimensions_guard before insert or update or delete on public.evaluation_dimensions
  for each row execute function app.guard_framework_children();
create trigger trg_evaluation_criteria_guard before insert or update or delete on public.evaluation_criteria
  for each row execute function app.guard_framework_children();
create trigger trg_position_criteria_weights_guard before insert or update or delete on public.position_criteria_weights
  for each row execute function app.guard_framework_children();
create trigger trg_position_dimension_weights_guard before insert or update or delete on public.position_dimension_weights
  for each row execute function app.guard_framework_children();

create trigger trg_evaluation_criteria_consistency before insert or update on public.evaluation_criteria
  for each row execute function app.guard_evaluation_consistency();
create trigger trg_position_criteria_weights_consistency before insert or update on public.position_criteria_weights
  for each row execute function app.guard_evaluation_consistency();
create trigger trg_evaluation_sessions_consistency before insert or update on public.evaluation_sessions
  for each row execute function app.guard_evaluation_consistency();
create trigger trg_individual_evaluations_consistency before insert or update on public.individual_evaluations
  for each row execute function app.guard_evaluation_consistency();
create trigger trg_evaluation_scores_consistency before insert or update on public.evaluation_scores
  for each row execute function app.guard_evaluation_consistency();

create trigger trg_evaluation_sessions_workflow before insert or update on public.evaluation_sessions
  for each row execute function app.guard_workflow('evaluations.validate');
create trigger trg_evaluation_sessions_history after insert or update on public.evaluation_sessions
  for each row execute function app.track_status();

create trigger trg_individual_evaluations_lock before insert or update or delete on public.individual_evaluations
  for each row execute function app.guard_evaluation_children();
create trigger trg_evaluation_scores_lock before insert or update or delete on public.evaluation_scores
  for each row execute function app.guard_evaluation_children();
create trigger trg_evaluation_evidence_lock before insert or update or delete on public.evaluation_evidence
  for each row execute function app.guard_evaluation_children();

-- Notification au staff quand une évaluation est validée.
create or replace function app.notify_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'valide' and (tg_op = 'INSERT' or old.status is distinct from 'valide') then
    perform app.notify_staff(new.club_id, 'evaluation', 'Nouvelle évaluation validée', new.title,
                             '/performance/evaluations/' || new.id);
  end if;
  return new;
end;
$$;
create trigger trg_evaluation_sessions_notify after insert or update on public.evaluation_sessions
  for each row execute function app.notify_evaluation();

-- ----------------------------------------------------------------- Nouvelle version (copie d'une version)
create or replace function public.clone_framework_version(p_version uuid, p_label text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.framework_versions;
  v_new uuid;
  v_no smallint;
begin
  select * into v_src from public.framework_versions where id = p_version;
  if v_src.id is null then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if not app.has_permission(v_src.club_id, 'frameworks.manage') then
    raise exception 'Gestion des référentiels réservée.' using errcode = '42501';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_no from public.framework_versions where framework_id = v_src.framework_id;
  insert into public.framework_versions (club_id, framework_id, version_no, label, notes, created_by)
  values (v_src.club_id, v_src.framework_id, v_no, coalesce(nullif(trim(p_label), ''), 'Version ' || v_no),
          'Copie de la version ' || v_src.version_no, (select auth.uid()))
  returning id into v_new;

  insert into public.evaluation_dimensions (club_id, version_id, code, label, description, sort_order)
  select club_id, v_new, code, label, description, sort_order
  from public.evaluation_dimensions where version_id = p_version;

  insert into public.evaluation_criteria (club_id, version_id, dimension_id, code, label, description, default_weight, sort_order)
  select s.club_id, v_new, nd.id, s.code, s.label, s.description, s.default_weight, s.sort_order
  from public.evaluation_criteria s
  join public.evaluation_dimensions od on od.id = s.dimension_id
  join public.evaluation_dimensions nd on nd.version_id = v_new and nd.code = od.code
  where s.version_id = p_version;

  insert into public.position_criteria_weights (club_id, version_id, criterion_id, framework_key, weight)
  select w.club_id, v_new, nc.id, w.framework_key, w.weight
  from public.position_criteria_weights w
  join public.evaluation_criteria oc on oc.id = w.criterion_id
  join public.evaluation_criteria nc on nc.version_id = v_new and nc.code = oc.code
  where w.version_id = p_version;

  insert into public.position_dimension_weights (club_id, version_id, framework_key, dimension_code, weight)
  select club_id, v_new, framework_key, dimension_code, weight
  from public.position_dimension_weights where version_id = p_version;

  return v_new;
end;
$$;
revoke all on function public.clone_framework_version(uuid, text) from public, anon;
grant execute on function public.clone_framework_version(uuid, text) to authenticated;

-- Publication : contrôle des pondérations (100 % par poste), archive la version précédente.
create or replace function public.publish_framework_version(p_version uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.framework_versions;
  r record;
  k text;
begin
  select * into v from public.framework_versions where id = p_version;
  if v.id is null then raise exception 'Version introuvable.' using errcode = 'P0002'; end if;
  if not app.has_permission(v.club_id, 'frameworks.manage') then
    raise exception 'Gestion des référentiels réservée.' using errcode = '42501';
  end if;
  if v.status <> 'brouillon' then raise exception 'Seul un brouillon peut être publié.' using errcode = '23514'; end if;

  foreach k in array array['GB','DC','DD_DG','N6','N8','N10','AILIERE','N9','PISTON'] loop
    select coalesce(sum(weight), 0) as total into r from public.position_dimension_weights
    where version_id = p_version and framework_key = k;
    if r.total <> 100 then
      raise exception 'Pondérations des dimensions du poste % : total % %% au lieu de 100 %%.', k, r.total using errcode = '23514';
    end if;
    select coalesce(sum(w.weight), 0) as total into r
    from public.position_criteria_weights w
    join public.evaluation_criteria c on c.id = w.criterion_id
    join public.evaluation_dimensions d on d.id = c.dimension_id
    where w.version_id = p_version and w.framework_key = k and d.code = 'technique';
    if r.total <> 100 then
      raise exception 'Référentiel technique du poste % : total % %% au lieu de 100 %%.', k, r.total using errcode = '23514';
    end if;
  end loop;

  update public.framework_versions set status = 'archive'
  where framework_id = v.framework_id and status = 'publie';
  update public.framework_versions set status = 'publie' where id = p_version;
end;
$$;
revoke all on function public.publish_framework_version(uuid) from public, anon;
grant execute on function public.publish_framework_version(uuid) to authenticated;

-- ----------------------------------------------------------------- Référentiel initial (cahier des charges §19-§24, §28, §38)
create or replace function app.seed_performance_framework(p_club uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fw uuid;
  v_ver uuid;
  v_dim uuid;
  d record;
  c record;
  i int;
begin
  if exists (select 1 from public.evaluation_frameworks where club_id = p_club and kind = 'individuel') then
    return null;
  end if;
  insert into public.evaluation_frameworks (club_id, kind, name, description)
  values (p_club, 'individuel', 'Référentiel d''évaluation individuelle',
          'Six dimensions, critères observables, pondérations par poste (cahier des charges §19 à §24).')
  returning id into v_fw;
  insert into public.framework_versions (club_id, framework_id, version_no, label, notes)
  values (p_club, v_fw, 1, 'Version 1 — cahier des charges', 'Référentiel initial du cahier des charges.')
  returning id into v_ver;

  -- Dimensions
  for d in select * from (values
    (1, 'technique', 'Technique', 'Chaque geste est noté en tenant compte de la qualité d''exécution, de l''efficacité, de la régularité, de l''adaptabilité et de la pertinence.'),
    (2, 'tactique', 'Tactique', 'Critères appréciés au regard du poste réellement occupé pendant la rencontre ou la séance.'),
    (3, 'athletique', 'Athlétique', 'Observation en situation de jeu. Les tests physiques et les données GPS arrivent avec le module Sport science.'),
    (4, 'cognitive', 'Cognitive', 'Distinguer les faits observables des interprétations de l''évaluateur.'),
    (5, 'mentale', 'Mentale', 'Comportements observables uniquement. Aucun diagnostic psychologique.'),
    (6, 'comportementale', 'Comportementale', 'Comportements observables uniquement.')
  ) as t(ord, code, label, descr) loop
    insert into public.evaluation_dimensions (club_id, version_id, code, label, description, sort_order)
    values (p_club, v_ver, d.code, d.label, d.descr, d.ord);
  end loop;

  -- Critères à poids égal pour tous les postes (default_weight = 1)
  i := 0;
  for c in select * from (values
    ('tactique','placement','Placement'), ('tactique','occupation_espaces','Occupation des espaces'),
    ('tactique','disponibilite','Disponibilité'), ('tactique','deplacements_sans_ballon','Déplacements sans ballon'),
    ('tactique','cadrage','Cadrage'), ('tactique','couverture','Couverture'), ('tactique','equilibre','Équilibre'),
    ('tactique','gestion_profondeur','Gestion de la profondeur'), ('tactique','protection_axe','Protection de l''axe'),
    ('tactique','pressing','Pressing'), ('tactique','repli','Repli'),
    ('tactique','transition_offensive','Transition offensive'), ('tactique','transition_defensive','Transition défensive'),
    ('tactique','responsabilites_tactiques','Respect des responsabilités tactiques'),
    ('tactique','adaptation_systeme','Adaptation au système de jeu'),
    ('athletique','endurance','Endurance'), ('athletique','vitesse','Vitesse'), ('athletique','acceleration','Accélération'),
    ('athletique','deceleration','Décélération'), ('athletique','explosivite','Explosivité'), ('athletique','agilite','Agilité'),
    ('athletique','coordination','Coordination'), ('athletique','puissance','Puissance'),
    ('athletique','repetition_efforts','Répétition des efforts'), ('athletique','recuperation_effort','Récupération entre les efforts'),
    ('cognitive','prise_information','Prise d''information'), ('cognitive','anticipation','Anticipation'),
    ('cognitive','lecture_jeu','Lecture du jeu'), ('cognitive','identification_espaces','Identification des espaces'),
    ('cognitive','vitesse_decision','Vitesse de décision'), ('cognitive','pertinence_choix','Pertinence des choix'),
    ('cognitive','adaptation_pression','Adaptation à la pression'), ('cognitive','comprehension_consignes','Compréhension des consignes'),
    ('mentale','concentration','Concentration'), ('mentale','reaction_erreur','Réaction après une erreur'),
    ('mentale','perseverance','Persévérance'), ('mentale','engagement','Engagement'),
    ('comportementale','discipline','Discipline'), ('comportementale','communication','Communication'),
    ('comportementale','responsabilite','Responsabilité'), ('comportementale','esprit_collectif','Esprit collectif'),
    ('comportementale','assiduite','Assiduité'), ('comportementale','ponctualite','Ponctualité')
  ) as t(dim, code, label) loop
    i := i + 1;
    insert into public.evaluation_criteria (club_id, version_id, dimension_id, code, label, default_weight, sort_order)
    select p_club, v_ver, dd.id, c.code, c.label, 1, i
    from public.evaluation_dimensions dd where dd.version_id = v_ver and dd.code = c.dim;
  end loop;

  -- Critères techniques : référentiel commun (§20) + gestes spécifiques aux postes.
  select id into v_dim from public.evaluation_dimensions where version_id = v_ver and code = 'technique';
  i := 0;
  for c in select * from (values
    ('controle_ballon','Contrôle du ballon'), ('controle_oriente','Contrôle orienté'), ('passe_courte','Passe courte'),
    ('passe_moyenne','Passe moyenne'), ('passe_longue','Passe longue'), ('passe_verticale','Passe verticale'),
    ('conduite','Conduite de balle'), ('dribble','Dribble'), ('protection','Protection du ballon'),
    ('une_touche','Jeu en une touche'), ('deux_touches','Jeu en deux touches'), ('pied_faible','Utilisation du pied faible'),
    ('jeu_aerien','Jeu aérien'), ('frappe','Frappe'), ('centre','Centre'), ('tacle','Tacle'), ('interception','Interception'),
    ('degagement','Dégagement'), ('sous_pression','Technique sous pression'), ('enchainement','Enchaînement technique'),
    ('prise_balle','Prise de balle'), ('plongeon','Plongeon'), ('arrets_reflexes','Arrêts réflexes'),
    ('sorties_aeriennes','Sorties aériennes'), ('duel_1c1','Duel en 1 contre 1'), ('relance_courte','Relance courte'),
    ('relance_longue','Relance longue'), ('relance_main','Relance à la main'),
    ('duel_defensif','Duel défensif'), ('tacle_interception','Tacle et interception'), ('relance_pression','Relance sous pression'),
    ('qualite_passe','Qualité de passe'), ('une_deux_touches','Jeu en une ou deux touches'), ('recuperation','Récupération du ballon'),
    ('passe_progressive','Passe progressive'), ('jeu_combinaison','Jeu en combinaison'),
    ('derniere_passe','Dernière passe'), ('passe_entre_lignes','Passe entre les lignes'), ('espace_reduit','Technique en espace réduit'),
    ('controle_mouvement','Contrôle en mouvement'), ('conduite_vitesse','Conduite à haute vitesse'), ('finition','Finition'),
    ('finition_pied_fort','Finition pied fort'), ('finition_pied_faible','Finition pied faible'),
    ('finition_une_touche','Finition en une touche'), ('jeu_tete','Jeu de tête'), ('controle_dos_but','Contrôle dos au but'),
    ('remise','Remise'), ('duel_gardienne','Duel face à la gardienne')
  ) as t(code, label) loop
    i := i + 1;
    insert into public.evaluation_criteria (club_id, version_id, dimension_id, code, label, default_weight, sort_order)
    values (p_club, v_ver, v_dim, c.code, c.label, null, i);
  end loop;

  insert into public.position_criteria_weights (club_id, version_id, criterion_id, framework_key, weight)
  select p_club, v_ver, cr.id, t.fk, t.w
  from (values
    ('GB','prise_balle',15),('GB','plongeon',15),('GB','arrets_reflexes',15),('GB','sorties_aeriennes',10),('GB','duel_1c1',10),
    ('GB','relance_courte',10),('GB','relance_longue',10),('GB','relance_main',10),('GB','controle_oriente',5),
    ('DC','controle_oriente',10),('DC','passe_courte',10),('DC','passe_verticale',15),('DC','passe_longue',10),('DC','duel_defensif',15),
    ('DC','jeu_aerien',15),('DC','tacle_interception',10),('DC','protection',5),('DC','relance_pression',10),
    ('DD_DG','controle_oriente',10),('DD_DG','qualite_passe',15),('DD_DG','conduite',10),('DD_DG','dribble',10),('DD_DG','centre',20),
    ('DD_DG','duel_defensif',15),('DD_DG','tacle_interception',10),('DD_DG','sous_pression',10),
    ('N6','controle_oriente',15),('N6','passe_courte',15),('N6','passe_verticale',15),('N6','passe_longue',10),('N6','une_deux_touches',10),
    ('N6','protection',10),('N6','recuperation',10),('N6','sous_pression',10),('N6','pied_faible',5),
    ('N8','controle_oriente',15),('N8','qualite_passe',15),('N8','passe_progressive',15),('N8','conduite',10),('N8','dribble',10),
    ('N8','jeu_combinaison',10),('N8','protection',10),('N8','frappe',5),('N8','sous_pression',10),
    ('N10','controle_oriente',15),('N10','derniere_passe',20),('N10','passe_entre_lignes',15),('N10','dribble',15),
    ('N10','jeu_combinaison',10),('N10','frappe',10),('N10','espace_reduit',10),('N10','pied_faible',5),
    ('AILIERE','controle_mouvement',10),('AILIERE','conduite_vitesse',15),('AILIERE','dribble',20),('AILIERE','centre',20),
    ('AILIERE','derniere_passe',10),('AILIERE','finition',10),('AILIERE','sous_pression',10),('AILIERE','pied_faible',5),
    ('N9','finition_pied_fort',15),('N9','finition_pied_faible',10),('N9','finition_une_touche',15),('N9','jeu_tete',10),
    ('N9','controle_dos_but',10),('N9','protection',10),('N9','remise',10),('N9','dribble',5),('N9','duel_gardienne',10),
    ('N9','sous_pression',5),
    ('PISTON','controle_oriente',10),('PISTON','qualite_passe',10),('PISTON','conduite',15),('PISTON','dribble',10),
    ('PISTON','centre',20),('PISTON','duel_defensif',15),('PISTON','jeu_combinaison',10),('PISTON','sous_pression',10)
  ) as t(fk, code, w)
  join public.evaluation_criteria cr on cr.version_id = v_ver and cr.code = t.code;

  insert into public.position_dimension_weights (club_id, version_id, framework_key, dimension_code, weight)
  select p_club, v_ver, t.fk, dims.code, (array[t.te, t.ta, t.at, t.co, t.me, t.cp])[dims.n]
  from (values
    ('GB',30,25,15,20,5,5), ('DC',20,35,20,15,5,5), ('DD_DG',25,25,25,15,5,5), ('N6',25,30,15,20,5,5),
    ('N8',25,25,20,20,5,5), ('N10',30,25,15,20,5,5), ('AILIERE',30,20,25,15,5,5), ('N9',30,25,20,15,5,5),
    ('PISTON',25,25,25,15,5,5)
  ) as t(fk, te, ta, at, co, me, cp)
  cross join (values (1,'technique'),(2,'tactique'),(3,'athletique'),(4,'cognitive'),(5,'mentale'),(6,'comportementale')) as dims(n, code);

  update public.framework_versions set status = 'publie', published_at = now() where id = v_ver;
  return v_ver;
end;
$$;
revoke all on function app.seed_performance_framework(uuid) from public, authenticated;

create or replace function app.on_club_created_seed_framework()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.seed_performance_framework(new.id);
  return new;
end;
$$;
create trigger trg_clubs_seed_framework after insert on public.clubs
  for each row execute function app.on_club_created_seed_framework();

select app.seed_performance_framework(id) from public.clubs;
