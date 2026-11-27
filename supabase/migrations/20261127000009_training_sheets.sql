-- =============================================================================
-- Migration 009 — Module Entraînement : fiches de séance professionnelles
-- Phases de séance, thèmes, matériel, schémas tactiques éditables, modèles,
-- charge individuelle (RPE / sRPE), évaluation par critères, bilan du staff.
-- Compatible avec les données existantes : aucune colonne supprimée.
-- =============================================================================

-- ----------------------------------------------------------------- Permission d'export
insert into public.permissions (code, module, label, is_sensitive, phase) values
  ('planning.export', 'planification', 'Imprimer, exporter et partager les fiches de séance', false, 2)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'planning.export'
where r.code in ('sporting_director', 'head_coach', 'assistant_coach', 'goalkeeper_coach', 'video_analyst',
                 'fitness_coach', 'team_manager', 'kit_manager')
on conflict do nothing;

-- ----------------------------------------------------------------- Bibliothèque des thèmes
create table public.training_themes (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  parent_id    uuid references public.training_themes(id) on delete cascade,
  name         text not null check (length(trim(name)) between 2 and 120),
  description  text check (length(description) <= 1000),
  archived_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique nulls not distinct (club_id, parent_id, name)
);
create index training_themes_club_idx on public.training_themes(club_id, parent_id);

-- ----------------------------------------------------------------- Schémas tactiques (données éditables)
create table public.tactical_diagrams (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  title        text not null check (length(trim(title)) between 2 and 120),
  data         jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 400000),
  archived_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tactical_diagrams_club_idx on public.tactical_diagrams(club_id);

-- ----------------------------------------------------------------- Exercices : contenu pédagogique complet
alter table public.exercises
  add column progression          text check (length(progression) <= 3000),
  add column constraints          text check (length(constraints) <= 2000),
  add column realisation_criteria text check (length(realisation_criteria) <= 2000),
  add column coaching_points      text check (length(coaching_points) <= 2000),
  add column series               smallint check (series between 1 and 50),
  add column equipment            text check (length(equipment) <= 1000),
  add column video_links          jsonb not null default '[]'::jsonb check (jsonb_typeof(video_links) = 'array' and jsonb_array_length(video_links) <= 20),
  add column diagram_id           uuid references public.tactical_diagrams(id) on delete set null;

-- ----------------------------------------------------------------- Séances : informations complémentaires
alter table public.training_sessions alter column theme drop not null;
alter table public.training_sessions
  add column theme_id            uuid references public.training_themes(id) on delete set null,
  add column sub_theme_id        uuid references public.training_themes(id) on delete set null,
  add column period              text check (length(period) <= 60),
  add column weather             text check (length(weather) <= 80),
  add column pitch_condition     text check (length(pitch_condition) <= 80),
  add column planned_rpe         smallint check (planned_rpe between 1 and 10),
  add column specific_objectives text[] not null default '{}' check (cardinality(specific_objectives) <= 12),
  add column video_links         jsonb not null default '[]'::jsonb check (jsonb_typeof(video_links) = 'array' and jsonb_array_length(video_links) <= 20),
  add column wizard_step         smallint not null default 1 check (wizard_step between 1 and 8),
  add column updated_by          uuid references auth.users(id) on delete set null;

create or replace function app.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;
create trigger trg_training_sessions_updated_by before insert or update on public.training_sessions
  for each row execute function app.set_updated_by();

-- ----------------------------------------------------------------- Phases de séance
create table public.session_phases (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  session_id    uuid not null references public.training_sessions(id) on delete cascade,
  sort_order    smallint not null default 0,
  title         text not null check (length(trim(title)) between 2 and 120),
  block         public.session_block,
  duration_min  smallint check (duration_min between 1 and 180),
  notes         text check (length(notes) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index session_phases_session_idx on public.session_phases(session_id, sort_order);

alter table public.session_exercises alter column block drop not null;
alter table public.session_exercises
  add column phase_id          uuid references public.session_phases(id) on delete cascade,
  add column series            smallint check (series between 1 and 50),
  add column recovery_sec      smallint check (recovery_sec between 0 and 1800),
  add column pause_after_min   smallint check (pause_after_min between 0 and 60),
  add column diagram_id        uuid references public.tactical_diagrams(id) on delete set null;
create index session_exercises_phase_idx on public.session_exercises(phase_id, sort_order);

-- Reprise des exercices existants : une phase par bloc, dans l'ordre des blocs.
with blocks as (
  select distinct se.club_id, se.session_id, se.block
  from public.session_exercises se
  where se.phase_id is null and se.block is not null
), ins as (
  insert into public.session_phases (club_id, session_id, sort_order, title, block)
  select b.club_id, b.session_id,
         (array_position(enum_range(null::public.session_block), b.block) - 1)::smallint,
         case b.block
           when 'activation' then 'Activation'
           when 'echauffement' then 'Échauffement'
           when 'mise_en_train' then 'Mise en train'
           when 'situation_apprentissage' then 'Situation d''apprentissage'
           when 'exercice_technique' then 'Exercice technique'
           when 'exercice_tactique' then 'Exercice tactique'
           when 'jeu_dirige' then 'Jeu dirigé'
           when 'jeu_application' then 'Jeu d''application'
           when 'retour_au_calme' then 'Retour au calme'
         end,
         b.block
  from blocks b
  returning id, session_id, block
)
update public.session_exercises se set phase_id = ins.id
from ins where ins.session_id = se.session_id and ins.block = se.block and se.phase_id is null;

-- ----------------------------------------------------------------- Matériel de séance
create table public.session_equipment (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  session_id  uuid not null references public.training_sessions(id) on delete cascade,
  item        text not null check (length(trim(item)) between 1 and 80),
  quantity    smallint not null default 1 check (quantity between 0 and 999),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, item)
);

-- ----------------------------------------------------------------- Modèles de séance
create table public.session_templates (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  name         text not null check (length(trim(name)) between 2 and 120),
  description  text check (length(description) <= 500),
  payload      jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 200000),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, name)
);

-- ----------------------------------------------------------------- Présences : participation et charge
alter table public.training_attendance
  add column participation text check (participation in ('complete', 'adaptee', 'partielle', 'aucune')),
  add column minutes       smallint check (minutes between 0 and 300),
  add column rpe           smallint check (rpe between 0 and 10),
  add column srpe          integer generated always as (minutes * rpe) stored;

-- ----------------------------------------------------------------- Évaluation et bilan
alter table public.session_evaluations
  add column criteria       jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) <= 20),
  add column appreciation   text check (appreciation in ('insuffisant', 'passable', 'satisfaisant', 'tres_satisfaisant', 'excellent')),
  add column difficulties   text check (length(difficulties) <= 2000),
  add column corrections    text check (length(corrections) <= 2000),
  add column next_objective text check (length(next_objective) <= 1000);

-- ----------------------------------------------------------------- Triggers communs
do $$
declare t text;
begin
  foreach t in array array['training_themes','tactical_diagrams','session_phases','session_equipment','session_templates'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
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

-- Le contenu d'une séance validée (phases, matériel) suit la règle des exercices.
create trigger trg_session_phases_guard before insert or update or delete on public.session_phases
  for each row execute function app.guard_session_children();
create trigger trg_session_equipment_guard before insert or update or delete on public.session_equipment
  for each row execute function app.guard_session_children();

-- Cohérence : une phase, un exercice et un schéma appartiennent au même club que la séance.
create or replace function app.guard_same_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'session_exercises' then
    if new.phase_id is not null and not exists (select 1 from public.session_phases p where p.id = new.phase_id and p.session_id = new.session_id) then
      raise exception 'Phase incohérente avec la séance.' using errcode = '23514';
    end if;
  end if;
  if tg_table_name in ('session_exercises', 'exercises') then
    if new.diagram_id is not null
       and not exists (select 1 from public.tactical_diagrams d where d.id = new.diagram_id and d.club_id = new.club_id) then
      raise exception 'Schéma tactique d''un autre club.' using errcode = '23514';
    end if;
  end if;
  if tg_table_name = 'training_sessions' then
    if (new.theme_id is not null and not exists (select 1 from public.training_themes t where t.id = new.theme_id and t.club_id = new.club_id))
       or (new.sub_theme_id is not null and not exists (select 1 from public.training_themes t where t.id = new.sub_theme_id and t.club_id = new.club_id)) then
      raise exception 'Thème d''un autre club.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_session_exercises_same_club before insert or update on public.session_exercises
  for each row execute function app.guard_same_club();
create trigger trg_exercises_same_club before insert or update on public.exercises
  for each row execute function app.guard_same_club();
create trigger trg_training_sessions_same_club before insert or update on public.training_sessions
  for each row execute function app.guard_same_club();
