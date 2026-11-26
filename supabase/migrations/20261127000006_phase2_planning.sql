-- =============================================================================
-- Migration 006 — Phase 2 : planification et entraînement
-- Macrocycle → Mésocycle → Microcycle → Séance → Exercice
-- Aucune donnée sportive fictive : uniquement la structure et les permissions.
-- =============================================================================

-- ----------------------------------------------------------------- Permissions
insert into public.permissions (code, module, label, is_sensitive, phase) values
  ('planning.validate',     'planification', 'Valider et publier la planification et les séances', false, 2),
  ('delegations.validate',  'competition',   'Valider les délégations officielles', false, 2)
on conflict (code) do nothing;

with matrix(role_code, perms) as (values
  ('sporting_director', array['planning.validate','delegations.validate']),
  ('head_coach',        array['planning.validate','delegations.validate']),
  ('admin',             array['delegations.write']),
  ('kit_manager',       array['delegations.write']),
  ('video_analyst',     array['planning.write'])
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.code = m.role_code
cross join lateral unnest(m.perms) as perm(code)
join public.permissions p on p.code = perm.code
on conflict do nothing;

-- ----------------------------------------------------------------- Types
create type public.calendar_event_type as enum (
  'seance_video', 'test_physique', 'reunion', 'deplacement', 'stage', 'repos', 'recuperation', 'soins', 'autre'
);
create type public.intensity_level as enum ('repos', 'faible', 'moderee', 'elevee', 'maximale');
create type public.session_block as enum (
  'activation', 'echauffement', 'mise_en_train', 'situation_apprentissage', 'exercice_technique',
  'exercice_tactique', 'jeu_dirige', 'jeu_application', 'retour_au_calme'
);
create type public.exercise_category as enum (
  'technique_offensive', 'technique_defensive', 'tactique_offensive', 'tactique_defensive',
  'transition_offensive', 'transition_defensive', 'pressing', 'cpa', 'gardiennes', 'endurance',
  'vitesse', 'coordination', 'developpement_individuel', 'developpement_sectoriel', 'developpement_collectif'
);
create type public.attendance_status as enum (
  'present', 'retard', 'absente_justifiee', 'absente_non_justifiee', 'blessee', 'dispensee'
);

-- ----------------------------------------------------------------- Cycles
create table public.macrocycles (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  season_id   uuid not null references public.seasons(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null check (length(trim(name)) > 1),
  starts_on   date not null,
  ends_on     date not null,
  objective   text check (length(objective) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index macrocycles_season_idx on public.macrocycles(season_id, team_id, starts_on);

create table public.mesocycles (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  macrocycle_id  uuid not null references public.macrocycles(id) on delete cascade,
  name           text not null check (length(trim(name)) > 1),
  starts_on      date not null,
  ends_on        date not null,
  objective      text check (length(objective) <= 1000),
  focus          text check (length(focus) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index mesocycles_macro_idx on public.mesocycles(macrocycle_id, starts_on);

-- Microcycle = une semaine (lundi) d'une équipe. Porte le workflow du programme hebdomadaire.
create table public.microcycles (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  season_id      uuid not null references public.seasons(id) on delete cascade,
  mesocycle_id   uuid references public.mesocycles(id) on delete set null,
  week_start     date not null check (extract(isodow from week_start) = 1),
  label          text,
  objective      text check (length(objective) <= 1000),
  status         public.workflow_status not null default 'brouillon',
  validated_by   uuid references auth.users(id) on delete set null,
  validated_at   timestamptz,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (team_id, week_start)
);
create index microcycles_season_idx on public.microcycles(season_id, week_start);

-- ----------------------------------------------------------------- Agenda
-- Activités hors entraînements et matchs (ceux-ci ont leurs propres tables :
-- aucune double saisie). Toutes apparaissent dans le calendrier et le programme.
create table public.calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  team_id               uuid not null references public.teams(id) on delete cascade,
  season_id             uuid references public.seasons(id) on delete set null,
  microcycle_id         uuid references public.microcycles(id) on delete set null,
  type                  public.calendar_event_type not null,
  title                 text not null check (length(trim(title)) > 1),
  event_date            date not null,
  starts_at             time,
  ends_at               time,
  location              text,
  theme                 text,
  sub_theme             text,
  objective             text check (length(objective) <= 1000),
  intensity             public.intensity_level,
  responsible_staff_id  uuid references public.staff_members(id) on delete set null,
  audience              text,
  notes                 text check (length(notes) <= 2000),
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index calendar_events_date_idx on public.calendar_events(club_id, event_date);

-- ----------------------------------------------------------------- Exercices
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  title             text not null check (length(trim(title)) > 1),
  category          public.exercise_category not null,
  objective         text check (length(objective) <= 1000),
  organisation      text check (length(organisation) <= 3000),
  dimensions        text,
  players_count     text,
  duration_min      smallint check (duration_min between 1 and 180),
  repetitions       text,
  recovery          text,
  instructions      text check (length(instructions) <= 3000),
  success_criteria  text check (length(success_criteria) <= 2000),
  variables         text check (length(variables) <= 2000),
  corrections       text check (length(corrections) <= 2000),
  video_url         text check (video_url is null or video_url ~* '^https://'),
  diagram_path      text,
  archived_at       timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (club_id, title)
);
create index exercises_category_idx on public.exercises(club_id, category) where archived_at is null;

-- ----------------------------------------------------------------- Séances
create table public.training_sessions (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  team_id               uuid not null references public.teams(id) on delete cascade,
  season_id             uuid not null references public.seasons(id) on delete cascade,
  microcycle_id         uuid references public.microcycles(id) on delete set null,
  number                integer not null,
  session_date          date not null,
  starts_at             time,
  ends_at               time,
  location              text,
  theme                 text not null check (length(trim(theme)) > 1),
  sub_theme             text,
  main_objective        text check (length(main_objective) <= 1000),
  secondary_objectives  text check (length(secondary_objectives) <= 2000),
  audience              text,
  intensity             public.intensity_level,
  game_system           text,
  responsible_staff_id  uuid references public.staff_members(id) on delete set null,
  equipment             text check (length(equipment) <= 1000),
  notes                 text check (length(notes) <= 2000),
  status                public.workflow_status not null default 'brouillon',
  validated_by          uuid references auth.users(id) on delete set null,
  validated_at          timestamptz,
  published_at          timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (season_id, team_id, number),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index training_sessions_date_idx on public.training_sessions(club_id, session_date);

-- Numéro de séance automatique par saison et équipe.
create or replace function app.next_session_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext(new.season_id::text || new.team_id::text));
    select coalesce(max(number), 0) + 1 into new.number
    from public.training_sessions where season_id = new.season_id and team_id = new.team_id;
  end if;
  return new;
end;
$$;
create trigger trg_training_sessions_number before insert on public.training_sessions
  for each row execute function app.next_session_number();

create table public.session_exercises (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  session_id    uuid not null references public.training_sessions(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete restrict,
  block         public.session_block not null,
  sort_order    smallint not null default 0,
  duration_min  smallint check (duration_min between 1 and 180),
  repetitions   text,
  recovery      text,
  notes         text check (length(notes) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index session_exercises_session_idx on public.session_exercises(session_id, block, sort_order);

create table public.training_attendance (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  session_id  uuid not null references public.training_sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  status      public.attendance_status not null,
  note        text check (length(note) <= 300),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, player_id)
);
create index training_attendance_player_idx on public.training_attendance(player_id);

create table public.session_evaluations (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  session_id           uuid not null unique references public.training_sessions(id) on delete cascade,
  objectives_reached   smallint check (objectives_reached between 1 and 5),
  engagement           smallint check (engagement between 1 and 5),
  intensity_observed   public.intensity_level,
  actual_duration_min  smallint check (actual_duration_min between 1 and 300),
  strengths            text check (length(strengths) <= 2000),
  improvements         text check (length(improvements) <= 2000),
  evaluated_by         uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------- Historique des validations
create table public.approval_history (
  id           bigint generated always as identity primary key,
  club_id      uuid not null references public.clubs(id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  from_status  text,
  to_status    text not null,
  actor_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index approval_history_entity_idx on public.approval_history(entity_type, entity_id, created_at desc);

-- Workflow Brouillon → Soumis → Validé → Publié → Archivé.
-- TG_ARGV[0] = permission requise pour valider/publier (et pour modifier un élément validé).
create or replace function app.guard_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perm text := tg_argv[0];
  v_old text := case when tg_op = 'UPDATE' then old.status::text end;
  v_new text := new.status::text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' and v_new not in ('brouillon', 'soumis') and not app.has_permission(new.club_id, v_perm) then
    raise exception 'Validation réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if v_old in ('valide', 'publie', 'archive') and not app.has_permission(new.club_id, v_perm) then
      raise exception 'Élément validé : modification réservée aux personnes autorisées.' using errcode = '42501';
    end if;
    if v_new is distinct from v_old and v_new in ('valide', 'publie', 'archive') and not app.has_permission(new.club_id, v_perm) then
      raise exception 'Validation réservée aux personnes autorisées.' using errcode = '42501';
    end if;
  end if;
  if v_new in ('valide', 'publie') and (tg_op = 'INSERT' or v_old not in ('valide', 'publie')) then
    new.validated_by := (select auth.uid());
    new.validated_at := now();
  end if;
  if v_new = 'publie' and (tg_op = 'INSERT' or v_old is distinct from 'publie') then
    new.published_at := now();
  end if;
  if v_new in ('brouillon', 'soumis') then
    new.validated_by := null;
    new.validated_at := null;
    new.published_at := null;
  end if;
  return new;
end;
$$;

-- Historise chaque changement de statut.
create or replace function app.track_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status::text is distinct from old.status::text then
    insert into public.approval_history (club_id, entity_type, entity_id, from_status, to_status, actor_id)
    values (new.club_id, tg_table_name, new.id,
            case when tg_op = 'UPDATE' then old.status::text end, new.status::text, (select auth.uid()));
  end if;
  return new;
end;
$$;

-- Notifie le staff du club (sauf l'auteur) à la publication.
create or replace function app.notify_staff(p_club uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (club_id, user_id, kind, title, body, link)
  select distinct p_club, ur.user_id, p_kind, p_title, p_body, p_link
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.club_id = p_club and ur.revoked_at is null and r.is_staff
    and ur.user_id is distinct from (select auth.uid());
$$;
revoke all on function app.notify_staff(uuid, text, text, text, text) from public, authenticated;

create or replace function app.notify_planning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publie' and (tg_op = 'INSERT' or old.status is distinct from 'publie') then
    if tg_table_name = 'microcycles' then
      perform app.notify_staff(new.club_id, 'programme', 'Programme hebdomadaire publié',
        'Semaine du ' || to_char(new.week_start, 'DD/MM/YYYY'), '/planification/programme?semaine=' || new.week_start);
    elsif tg_table_name = 'training_sessions' then
      perform app.notify_staff(new.club_id, 'seance', 'Nouvelle séance publiée',
        'Séance n°' || new.number || ' du ' || to_char(new.session_date, 'DD/MM/YYYY'), '/entrainement/seances/' || new.id);
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'publie' and tg_table_name = 'training_sessions'
        and (new.session_date, new.starts_at, new.ends_at) is distinct from (old.session_date, old.starts_at, old.ends_at) then
    perform app.notify_staff(new.club_id, 'horaire', 'Modification d''horaire',
      'Séance n°' || new.number || ' : ' || to_char(new.session_date, 'DD/MM/YYYY') || coalesce(' à ' || to_char(new.starts_at, 'HH24:MI'), ''),
      '/entrainement/seances/' || new.id);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------- Triggers
do $$
declare t text;
begin
  foreach t in array array['macrocycles','mesocycles','microcycles','calendar_events','exercises',
                           'training_sessions','session_exercises','training_attendance','session_evaluations'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
  end loop;
end $$;

create trigger trg_microcycles_workflow before insert or update on public.microcycles
  for each row execute function app.guard_workflow('planning.validate');
create trigger trg_training_sessions_workflow before insert or update on public.training_sessions
  for each row execute function app.guard_workflow('planning.validate');
create trigger trg_microcycles_history after insert or update on public.microcycles
  for each row execute function app.track_status();
create trigger trg_training_sessions_history after insert or update on public.training_sessions
  for each row execute function app.track_status();
create trigger trg_microcycles_notify after insert or update on public.microcycles
  for each row execute function app.notify_planning();
create trigger trg_training_sessions_notify after insert or update on public.training_sessions
  for each row execute function app.notify_planning();

-- Le contenu d'une séance validée (exercices) suit la même règle que la séance.
create or replace function app.guard_session_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  select status::text, club_id into v_status, v_club
  from public.training_sessions where id = coalesce(new.session_id, old.session_id);
  if v_status in ('valide', 'publie', 'archive') and not app.has_permission(v_club, 'planning.validate') then
    raise exception 'Séance validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_session_exercises_guard before insert or update or delete on public.session_exercises
  for each row execute function app.guard_session_children();

-- ----------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['macrocycles','mesocycles','microcycles','calendar_events','exercises',
                           'training_sessions','session_exercises','training_attendance','session_evaluations','approval_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['macrocycles','mesocycles','microcycles','calendar_events','exercises',
                           'training_sessions','session_exercises','session_evaluations'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'planning.read'))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'planning.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'planning.write')) with check (app.has_permission(club_id, 'planning.write'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'planning.write'))$f$, t);
  end loop;
end $$;

-- Une séance validée/publiée ne peut être supprimée que par un valideur.
drop policy training_sessions_delete on public.training_sessions;
create policy training_sessions_delete on public.training_sessions for delete to authenticated
  using (app.has_permission(club_id, 'planning.write')
         and (status in ('brouillon', 'soumis') or app.has_permission(club_id, 'planning.validate')));
drop policy microcycles_delete on public.microcycles;
create policy microcycles_delete on public.microcycles for delete to authenticated
  using (app.has_permission(club_id, 'planning.write')
         and (status in ('brouillon', 'soumis') or app.has_permission(club_id, 'planning.validate')));

-- Les joueuses (portail) voient le programme et les séances PUBLIÉS uniquement.
create policy microcycles_select_player on public.microcycles for select to authenticated
  using (status = 'publie' and app.my_player_id() is not null and app.is_club_member(club_id));
create policy training_sessions_select_player on public.training_sessions for select to authenticated
  using (status = 'publie' and app.my_player_id() is not null and app.is_club_member(club_id));

-- Présences : saisies par le staff qui planifie ; une joueuse voit les siennes.
create policy attendance_select on public.training_attendance for select to authenticated
  using (app.has_permission(club_id, 'planning.read') or player_id = app.my_player_id());
create policy attendance_insert on public.training_attendance for insert to authenticated
  with check (app.has_permission(club_id, 'planning.write'));
create policy attendance_update on public.training_attendance for update to authenticated
  using (app.has_permission(club_id, 'planning.write')) with check (app.has_permission(club_id, 'planning.write'));
create policy attendance_delete on public.training_attendance for delete to authenticated
  using (app.has_permission(club_id, 'planning.write'));

-- Historique des validations : lecture staff, écriture par trigger uniquement.
create policy approval_history_select on public.approval_history for select to authenticated
  using (app.is_club_staff(club_id));
revoke insert, update, delete, truncate on public.approval_history from authenticated;

-- ----------------------------------------------------------------- Stockage des schémas d'exercices
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('exercise-diagrams', 'exercise-diagrams', false, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy exercise_diagrams_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-diagrams' and app.has_permission(app.path_club(name), 'planning.read'));
create policy exercise_diagrams_write on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-diagrams' and app.has_permission(app.path_club(name), 'planning.write'));
create policy exercise_diagrams_update on storage.objects for update to authenticated
  using (bucket_id = 'exercise-diagrams' and app.has_permission(app.path_club(name), 'planning.write'));
create policy exercise_diagrams_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-diagrams' and app.has_permission(app.path_club(name), 'planning.write'));
