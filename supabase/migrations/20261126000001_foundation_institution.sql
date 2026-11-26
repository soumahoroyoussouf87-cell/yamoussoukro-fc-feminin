-- =============================================================================
-- YAMOUSSOUKRO FC FEMININ — HIGH PERFORMANCE CENTER
-- Migration 001 — Fondations : institution, identité, rôles et permissions
-- =============================================================================
-- Principes :
--   * identifiants UUID, clés étrangères, contraintes et index explicites ;
--   * created_at / updated_at sur chaque table métier ;
--   * toutes les données sont rattachées à un club (multi-club, multi-catégorie) ;
--   * les permissions sont calculées UNIQUEMENT à partir des tables user_roles /
--     role_permissions, jamais à partir de métadonnées modifiables par l'utilisateur.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schéma privé : fonctions de sécurité non exposées par l'API REST.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.team_category as enum ('senior', 'u20', 'u17', 'u15', 'u13', 'academie', 'autre');
create type public.competition_type as enum ('championnat', 'coupe', 'amical', 'tournoi', 'autre');
create type public.preferred_foot as enum ('droit', 'gauche', 'deux');
create type public.player_admin_status as enum ('licenciee', 'en_cours', 'non_licenciee', 'pret', 'essai', 'partie');
create type public.player_season_status as enum ('active', 'pret', 'blessee_longue_duree', 'partie');
create type public.availability_status as enum ('disponible', 'incertaine', 'restreinte', 'indisponible');
create type public.availability_reason as enum (
  'blessure', 'maladie', 'suspension', 'selection_nationale', 'raison_personnelle',
  'administratif', 'scolaire_professionnel', 'autre'
);
create type public.staff_status as enum ('actif', 'inactif', 'parti');
create type public.position_line as enum ('gardienne', 'defense', 'milieu', 'attaque');
create type public.workflow_status as enum ('brouillon', 'soumis', 'valide', 'publie', 'archive');

-- -----------------------------------------------------------------------------
-- Institution
-- -----------------------------------------------------------------------------
create table public.clubs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 1),
  short_name    text,
  tagline       text,
  city          text,
  country       text not null default 'Côte d''Ivoire',
  logo_path     text,           -- chemin du logo officiel dans le stockage privé « club-assets »
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_clubs_updated before update on public.clubs
  for each row execute function app.set_updated_at();

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  category    public.team_category not null default 'senior',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, name)
);
create index teams_club_idx on public.teams(club_id);
create unique index teams_one_default_per_club on public.teams(club_id) where is_default;
create trigger trg_teams_updated before update on public.teams
  for each row execute function app.set_updated_at();

create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  label       text not null,                      -- ex. « 2026-2027 »
  starts_on   date not null,
  ends_on     date not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, label),
  check (ends_on > starts_on)
);
create index seasons_club_idx on public.seasons(club_id);
create unique index seasons_one_active_per_club on public.seasons(club_id) where is_active;
create trigger trg_seasons_updated before update on public.seasons
  for each row execute function app.set_updated_at();

create table public.competitions (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  season_id          uuid not null references public.seasons(id) on delete cascade,
  team_id            uuid not null references public.teams(id) on delete cascade,
  name               text not null,
  type               public.competition_type not null default 'championnat',
  squad_size_limit   smallint not null default 18 check (squad_size_limit between 11 and 40),
  is_primary         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (season_id, team_id, name)
);
create index competitions_club_idx on public.competitions(club_id);
create index competitions_season_idx on public.competitions(season_id);
create trigger trg_competitions_updated before update on public.competitions
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (1-1 avec auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default '',
  email        text,
  avatar_path  text,
  theme        text not null default 'dark' check (theme in ('dark', 'light')),
  locale       text not null default 'fr-CI',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function app.set_updated_at();

-- Création automatique du profil. Le nom vient des métadonnées d'invitation
-- (purement descriptif, jamais utilisé pour les permissions).
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- -----------------------------------------------------------------------------
-- Rôles et permissions
-- -----------------------------------------------------------------------------
create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[a-z_]+$'),
  label        text not null,
  description  text,
  is_staff     boolean not null default true,
  sort_order   smallint not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_roles_updated before update on public.roles
  for each row execute function app.set_updated_at();

create table public.permissions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module        text not null,
  label         text not null,
  is_sensitive  boolean not null default false,
  phase         smallint not null default 1,
  created_at    timestamptz not null default now()
);

create table public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_id  uuid not null references public.permissions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index role_permissions_perm_idx on public.role_permissions(permission_id);

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete restrict,
  team_id     uuid references public.teams(id) on delete cascade, -- null = toutes les équipes du club
  granted_by  uuid references auth.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index user_roles_unique_active
  on public.user_roles(user_id, club_id, role_id, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;
create index user_roles_user_idx on public.user_roles(user_id) where revoked_at is null;
create index user_roles_club_idx on public.user_roles(club_id);
create trigger trg_user_roles_updated before update on public.user_roles
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions de sécurité (SECURITY DEFINER, search_path verrouillé)
-- -----------------------------------------------------------------------------
create or replace function app.has_permission(p_club uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and ur.club_id = p_club
      and ur.revoked_at is null
      and p.code = p_permission
  );
$$;

create or replace function app.is_club_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.club_id = p_club
      and ur.revoked_at is null
  );
$$;

create or replace function app.is_club_staff(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.club_id = p_club
      and ur.revoked_at is null
      and r.is_staff
  );
$$;

grant execute on function app.has_permission(uuid, text) to authenticated;
grant execute on function app.is_club_member(uuid) to authenticated;
grant execute on function app.is_club_staff(uuid) to authenticated;

-- RPC exposée : permissions effectives de l'utilisateur connecté (pour l'interface).
-- L'interface s'en sert pour masquer des actions ; la sécurité réelle reste la RLS.
create or replace function public.my_memberships()
returns table (club_id uuid, club_name text, role_code text, role_label text, team_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select ur.club_id, c.name, r.code, r.label, ur.team_id
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.clubs c on c.id = ur.club_id
  where ur.user_id = (select auth.uid()) and ur.revoked_at is null
  order by c.name, r.sort_order;
$$;

create or replace function public.my_permissions(p_club uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.code
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = (select auth.uid())
    and ur.club_id = p_club
    and ur.revoked_at is null;
$$;
revoke execute on function public.my_memberships() from public, anon;
revoke execute on function public.my_permissions(uuid) from public, anon;
grant execute on function public.my_memberships() to authenticated;
grant execute on function public.my_permissions(uuid) to authenticated;

-- Anti-escalade : seul un détenteur de « users.manage » peut attribuer un rôle,
-- personne ne peut s'attribuer à soi-même un rôle, et le dernier administrateur
-- actif d'un club ne peut pas être retiré.
create or replace function app.guard_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role uuid;
  v_remaining int;
begin
  -- Les opérations techniques (service_role / postgres) ne passent pas par auth.uid().
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' and new.user_id = (select auth.uid()) then
    raise exception 'Un utilisateur ne peut pas s''attribuer un rôle à lui-même.'
      using errcode = '42501';
  end if;

  -- Une attribution ne se modifie pas : on la révoque puis on en crée une nouvelle.
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.role_id <> old.role_id
       or new.club_id <> old.club_id or new.team_id is distinct from old.team_id) then
    raise exception 'Une attribution de rôle ne peut pas être modifiée, seulement révoquée.'
      using errcode = '42501';
  end if;

  select id into v_admin_role from public.roles where code = 'admin';

  if tg_op = 'UPDATE' and old.role_id = v_admin_role and old.revoked_at is null and new.revoked_at is not null
     or tg_op = 'DELETE' and old.role_id = v_admin_role and old.revoked_at is null then
    select count(*) into v_remaining
    from public.user_roles
    where club_id = old.club_id and role_id = v_admin_role and revoked_at is null and id <> old.id;
    if v_remaining = 0 then
      raise exception 'Impossible de retirer le dernier administrateur du club.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.granted_by := (select auth.uid());
    new.granted_at := now();
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function app.guard_user_roles();
