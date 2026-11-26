-- =============================================================================
-- Migration 002 — Effectif, staff, disponibilité, noyau compétition, audit
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Référentiel des postes (global, non lié à un club)
-- -----------------------------------------------------------------------------
create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  line        public.position_line not null,
  framework_key text not null,   -- clé de pondération du Performance Framework (GB, DC, DD_DG, N6...)
  sort_order  smallint not null,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Joueuses
-- -----------------------------------------------------------------------------
create table public.players (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  profile_id       uuid unique references public.profiles(id) on delete set null, -- compte du portail joueuse
  first_name       text not null check (length(trim(first_name)) > 0),
  last_name        text not null check (length(trim(last_name)) > 0),
  birth_date       date check (birth_date > date '1950-01-01'),
  nationality      text,
  height_cm        smallint check (height_cm between 120 and 220),
  preferred_foot   public.preferred_foot,
  photo_path       text,
  joined_on        date,
  admin_status     public.player_admin_status not null default 'en_cours',
  licence_number   text,
  created_by       uuid references auth.users(id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index players_club_idx on public.players(club_id) where archived_at is null;
create index players_name_idx on public.players(club_id, last_name, first_name);
create unique index players_licence_unique on public.players(club_id, licence_number) where licence_number is not null;
create trigger trg_players_updated before update on public.players
  for each row execute function app.set_updated_at();

-- Appartenance d'une joueuse à une équipe pour une saison (numéro, rôle tactique).
create table public.player_seasons (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  season_id      uuid not null references public.seasons(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  shirt_number   smallint check (shirt_number between 1 and 99),
  tactical_role  text,
  status         public.player_season_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (player_id, season_id, team_id)
);
create unique index player_seasons_shirt_unique
  on public.player_seasons(season_id, team_id, shirt_number)
  where shirt_number is not null and status <> 'partie';
create index player_seasons_season_idx on public.player_seasons(season_id, team_id);
create trigger trg_player_seasons_updated before update on public.player_seasons
  for each row execute function app.set_updated_at();

create table public.player_positions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  position_id  uuid not null references public.positions(id) on delete restrict,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (player_id, position_id)
);
create unique index player_positions_one_primary on public.player_positions(player_id) where is_primary;

create table public.player_documents (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  kind          text not null check (kind in ('licence', 'piece_identite', 'certificat_aptitude', 'autorisation_parentale', 'contrat', 'consentement_image', 'autre')),
  title         text not null,
  storage_path  text not null unique,
  expires_on    date,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index player_documents_player_idx on public.player_documents(player_id);
create trigger trg_player_documents_updated before update on public.player_documents
  for each row execute function app.set_updated_at();

-- Disponibilité SPORTIVE uniquement. Aucun détail médical ici : le diagnostic,
-- les soins et la réathlétisation vivront dans le module médical séparé (Phase 5).
create table public.player_availability (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete cascade,
  status            public.availability_status not null,
  reason            public.availability_reason,
  sporting_note     text check (length(sporting_note) <= 500),
  starts_on         date not null default current_date,
  expected_end_on   date,
  ended_on          date,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (expected_end_on is null or expected_end_on >= starts_on),
  check (ended_on is null or ended_on >= starts_on),
  check (status = 'disponible' or reason is not null)
);
create index player_availability_current_idx on public.player_availability(player_id, starts_on desc);
create trigger trg_player_availability_updated before update on public.player_availability
  for each row execute function app.set_updated_at();

-- Statut courant : dernière déclaration non clôturée, sinon « disponible ».
create or replace view public.player_current_availability
with (security_invoker = true) as
select p.id as player_id,
       p.club_id,
       coalesce(a.status, 'disponible'::public.availability_status) as status,
       a.reason,
       a.sporting_note,
       a.starts_on,
       a.expected_end_on,
       a.id as availability_id
from public.players p
left join lateral (
  select pa.*
  from public.player_availability pa
  where pa.player_id = p.id
    and pa.starts_on <= current_date
    and (pa.ended_on is null or pa.ended_on >= current_date)
  order by pa.starts_on desc, pa.created_at desc
  limit 1
) a on true
where p.archived_at is null;

-- -----------------------------------------------------------------------------
-- Staff
-- -----------------------------------------------------------------------------
create table public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  team_id       uuid references public.teams(id) on delete set null,
  profile_id    uuid unique references public.profiles(id) on delete set null,
  role_id       uuid not null references public.roles(id) on delete restrict, -- fonction occupée
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text not null check (length(trim(last_name)) > 0),
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text,
  photo_path    text,
  qualifications text,
  starts_on     date,
  ends_on       date,
  status        public.staff_status not null default 'actif',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index staff_members_club_idx on public.staff_members(club_id, status);
create trigger trg_staff_members_updated before update on public.staff_members
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Noyau compétition (les écrans arrivent en Phase 2 ; les indicateurs du
-- tableau de bord se calculent dès maintenant sur ces tables).
-- -----------------------------------------------------------------------------
create type public.match_status as enum ('programme', 'joue', 'reporte', 'annule');
create type public.home_away as enum ('domicile', 'exterieur', 'neutre');

create table public.opponents (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  city        text,
  logo_path   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, name)
);
create trigger trg_opponents_updated before update on public.opponents
  for each row execute function app.set_updated_at();

create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  season_id       uuid not null references public.seasons(id) on delete cascade,
  competition_id  uuid references public.competitions(id) on delete set null,
  opponent_id     uuid not null references public.opponents(id) on delete restrict,
  kickoff_at      timestamptz not null,
  venue           text,
  home_away       public.home_away not null default 'domicile',
  matchday        text,
  status          public.match_status not null default 'programme',
  goals_for       smallint check (goals_for >= 0),
  goals_against   smallint check (goals_against >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status <> 'joue' or (goals_for is not null and goals_against is not null))
);
create index matches_season_idx on public.matches(season_id, team_id, kickoff_at);
create trigger trg_matches_updated before update on public.matches
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Paramètres, notifications, journal d'audit
-- -----------------------------------------------------------------------------
create table public.application_settings (
  club_id                    uuid primary key references public.clubs(id) on delete cascade,
  active_season_id           uuid references public.seasons(id) on delete set null,
  active_competition_id      uuid references public.competitions(id) on delete set null,
  default_team_id            uuid references public.teams(id) on delete set null,
  min_observations_for_index smallint not null default 3 check (min_observations_for_index between 1 and 50),
  settings                   jsonb not null default '{}'::jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create trigger trg_application_settings_updated before update on public.application_settings
  for each row execute function app.set_updated_at();

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  club_id     uuid,
  actor_id    uuid,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_club_idx on public.audit_logs(club_id, created_at desc);
create index audit_logs_record_idx on public.audit_logs(table_name, record_id);

create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (club_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (
    nullif(v_row ->> 'club_id', '')::uuid,
    (select auth.uid()),
    tg_op,
    tg_table_name,
    nullif(v_row ->> 'id', '')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'players', 'player_seasons', 'player_positions', 'player_documents', 'player_availability',
    'staff_members', 'user_roles', 'seasons', 'competitions', 'teams', 'clubs',
    'matches', 'opponents', 'application_settings', 'role_permissions'
  ] loop
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function app.audit_row()', t);
  end loop;
end $$;
