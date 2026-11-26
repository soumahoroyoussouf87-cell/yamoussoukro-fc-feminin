-- =============================================================================
-- Migration 007 — Phase 2 : Match Center, convocations, onze de départ,
-- délégations, événements de match, classement.
-- Règle : une composition provisoire n'est JAMAIS officielle ; elle reste
-- confidentielle (lineups.read_draft) jusqu'à sa communication autorisée.
-- =============================================================================

-- ----------------------------------------------------------------- Dossier de match
alter table public.matches
  add column duration_min      smallint not null default 90 check (duration_min between 20 and 130),
  add column meeting_time      timestamptz,
  add column meeting_place     text,
  add column objectives        text check (length(objectives) <= 2000),
  add column game_plan         text check (length(game_plan) <= 4000),
  add column briefing          text check (length(briefing) <= 4000),
  add column logistics         text check (length(logistics) <= 2000),
  add column post_report       text check (length(post_report) <= 6000),
  add column development_axes  text check (length(development_axes) <= 3000),
  add column referee           text;

-- ----------------------------------------------------------------- Convocations
create type public.squad_player_status as enum ('convoquee', 'reserviste', 'non_retenue');

create table public.match_squads (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  match_id      uuid not null unique references public.matches(id) on delete cascade,
  size_limit    smallint not null default 18 check (size_limit between 11 and 40),
  notes         text check (length(notes) <= 2000),
  status        public.workflow_status not null default 'brouillon',
  validated_by  uuid references auth.users(id) on delete set null,
  validated_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.match_squad_players (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  squad_id              uuid not null references public.match_squads(id) on delete cascade,
  player_id             uuid not null references public.players(id) on delete cascade,
  status                public.squad_player_status not null default 'convoquee',
  shirt_number          smallint check (shirt_number between 1 and 99),
  confidential_comment  text check (length(confidential_comment) <= 500),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (squad_id, player_id)
);
create index match_squad_players_player_idx on public.match_squad_players(player_id);

-- Le nombre de convoquées ne peut pas dépasser la limite de la compétition.
create or replace function app.guard_squad_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit smallint;
  v_count int;
begin
  if new.status <> 'convoquee' then return new; end if;
  select size_limit into v_limit from public.match_squads where id = new.squad_id;
  select count(*) into v_count from public.match_squad_players
   where squad_id = new.squad_id and status = 'convoquee' and id <> new.id;
  if v_count + 1 > v_limit then
    raise exception 'Liste complète : % convoquées maximum pour cette rencontre.', v_limit using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_squad_players_size before insert or update on public.match_squad_players
  for each row execute function app.guard_squad_size();

-- ----------------------------------------------------------------- Onze de départ
create type public.lineup_status as enum ('provisoire', 'validee', 'communiquee');
create type public.lineup_slot as enum ('titulaire', 'remplacante');

create table public.lineups (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  match_id          uuid not null references public.matches(id) on delete cascade,
  label             text not null default 'Composition principale',
  system            text not null default '4-3-3',
  status            public.lineup_status not null default 'provisoire',
  version           integer not null default 1,
  instructions      text check (length(instructions) <= 3000),
  validated_by      uuid references auth.users(id) on delete set null,
  validated_at      timestamptz,
  communicated_at   timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (match_id, label)
);
-- Une seule composition officielle (validée ou communiquée) par rencontre.
create unique index lineups_one_official on public.lineups(match_id) where status <> 'provisoire';

create table public.lineup_players (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  lineup_id         uuid not null references public.lineups(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete cascade,
  slot              public.lineup_slot not null,
  position_label    text,
  x                 numeric(5,2) check (x between 0 and 100),
  y                 numeric(5,2) check (y between 0 and 100),
  is_captain        boolean not null default false,
  takes_penalties   boolean not null default false,
  takes_free_kicks  boolean not null default false,
  takes_corners     boolean not null default false,
  responsibilities  text check (length(responsibilities) <= 500),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  unique (lineup_id, player_id)
);
create unique index lineup_players_one_captain on public.lineup_players(lineup_id) where is_captain;
create index lineup_players_player_idx on public.lineup_players(player_id);

-- Historique des modifications : instantané complet à chaque enregistrement.
create table public.lineup_snapshots (
  id          bigint generated always as identity primary key,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  lineup_id   uuid not null references public.lineups(id) on delete cascade,
  version     integer not null,
  status      public.lineup_status not null,
  data        jsonb not null,
  saved_by    uuid references auth.users(id) on delete set null,
  saved_at    timestamptz not null default now()
);
create index lineup_snapshots_lineup_idx on public.lineup_snapshots(lineup_id, version desc);

-- Validation / communication réservées à « lineups.validate » ; une composition
-- officielle n'est plus modifiable sans repasser par un valideur.
create or replace function app.guard_lineup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'provisoire' and not app.has_permission(new.club_id, 'lineups.validate') then
      raise exception 'Validation réservée aux personnes autorisées.' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if (old.status <> 'provisoire' or new.status <> 'provisoire')
     and not app.has_permission(new.club_id, 'lineups.validate') then
    raise exception 'Composition officielle : action réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  if new.status = 'validee' and old.status <> 'validee' then
    new.validated_by := (select auth.uid()); new.validated_at := now();
  elsif new.status = 'communiquee' and old.status <> 'communiquee' then
    new.communicated_at := now();
    if old.status = 'provisoire' then new.validated_by := (select auth.uid()); new.validated_at := now(); end if;
  elsif new.status = 'provisoire' then
    new.validated_by := null; new.validated_at := null; new.communicated_at := null;
  end if;
  return new;
end;
$$;
create trigger trg_lineups_guard before insert or update on public.lineups
  for each row execute function app.guard_lineup();

create or replace function app.guard_lineup_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  select status::text, club_id into v_status, v_club from public.lineups where id = coalesce(new.lineup_id, old.lineup_id);
  if v_status <> 'provisoire' and not app.has_permission(v_club, 'lineups.validate') then
    raise exception 'Composition officielle : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_lineup_players_guard before insert or update or delete on public.lineup_players
  for each row execute function app.guard_lineup_players();

-- Lecture d'une composition : brouillons réservés à lineups.read_draft ;
-- version communiquée visible des personnes ayant accès aux rencontres et des joueuses.
create or replace function app.can_read_lineup(p_lineup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lineups l
    where l.id = p_lineup
      and (app.has_permission(l.club_id, 'lineups.read_draft')
           or (l.status = 'communiquee'
               and (app.has_permission(l.club_id, 'matches.read')
                    or (app.my_player_id() is not null and app.is_club_member(l.club_id)))))
  );
$$;
grant execute on function app.can_read_lineup(uuid) to authenticated;

-- ----------------------------------------------------------------- Événements de match
create type public.match_period as enum ('1MT', '2MT', 'PROL1', 'PROL2', 'TAB');
create type public.match_event_type as enum (
  'but', 'but_adverse', 'csc_pour', 'csc_contre', 'penalty_manque', 'carton_jaune', 'carton_rouge',
  'remplacement', 'changement_tactique', 'blessure', 'observation'
);

create table public.match_events (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  match_id           uuid not null references public.matches(id) on delete cascade,
  period             public.match_period not null default '1MT',
  minute             smallint not null check (minute between 0 and 130),
  added_minute       smallint check (added_minute between 1 and 30),
  type               public.match_event_type not null,
  player_id          uuid references public.players(id) on delete set null,   -- buteuse, joueuse avertie, joueuse sortante
  related_player_id  uuid references public.players(id) on delete set null,   -- passeuse décisive, joueuse entrante
  note               text check (length(note) <= 500),
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (type <> 'remplacement' or (player_id is not null and related_player_id is not null and player_id <> related_player_id)),
  check (type not in ('but', 'carton_jaune', 'carton_rouge') or player_id is not null)
);
create index match_events_match_idx on public.match_events(match_id, period, minute);

-- ----------------------------------------------------------------- Délégations
create type public.delegation_group as enum (
  'joueuse', 'staff_technique', 'staff_performance', 'staff_medical', 'administration', 'communication', 'logistique', 'autre'
);

create table public.delegations (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  match_id           uuid not null unique references public.matches(id) on delete cascade,
  head_staff_id      uuid references public.staff_members(id) on delete set null,
  driver             text,
  transport          text check (length(transport) <= 1000),
  departure_at       timestamptz,
  return_at          timestamptz,
  accommodation      text check (length(accommodation) <= 1000),
  catering           text check (length(catering) <= 1000),
  schedule           text check (length(schedule) <= 3000),
  equipment          text check (length(equipment) <= 2000),
  budget_planned     numeric(12,0) check (budget_planned >= 0),
  budget_actual      numeric(12,0) check (budget_actual >= 0),
  currency           text not null default 'XOF',
  trip_program       text check (length(trip_program) <= 4000),
  status             public.workflow_status not null default 'brouillon',
  validated_by       uuid references auth.users(id) on delete set null,
  validated_at       timestamptz,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (return_at is null or departure_at is null or return_at >= departure_at)
);

create table public.delegation_members (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  delegation_id    uuid not null references public.delegations(id) on delete cascade,
  member_group     public.delegation_group not null,
  player_id        uuid references public.players(id) on delete cascade,
  staff_member_id  uuid references public.staff_members(id) on delete cascade,
  external_name    text,
  function_label   text,
  room             text,
  created_at       timestamptz not null default now(),
  check (num_nonnulls(player_id, staff_member_id, external_name) = 1),
  check (member_group <> 'joueuse' or player_id is not null)
);
create unique index delegation_members_player on public.delegation_members(delegation_id, player_id) where player_id is not null;
create unique index delegation_members_staff on public.delegation_members(delegation_id, staff_member_id) where staff_member_id is not null;

-- ----------------------------------------------------------------- Classement (saisie officielle)
create table public.standings (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_name      text not null,
  is_own_team    boolean not null default false,
  position       smallint not null check (position between 1 and 40),
  played         smallint not null default 0 check (played >= 0),
  won            smallint not null default 0 check (won >= 0),
  drawn          smallint not null default 0 check (drawn >= 0),
  lost           smallint not null default 0 check (lost >= 0),
  goals_for      smallint not null default 0 check (goals_for >= 0),
  goals_against  smallint not null default 0 check (goals_against >= 0),
  points         smallint not null default 0,
  as_of          date not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (competition_id, team_name),
  check (won + drawn + lost = played)
);
create unique index standings_one_own on public.standings(competition_id) where is_own_team;

-- ----------------------------------------------------------------- Triggers communs
do $$
declare t text;
begin
  foreach t in array array['match_squads','match_squad_players','lineups','match_events','delegations','standings'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
  end loop;
  foreach t in array array['match_squads','match_squad_players','lineups','lineup_players','match_events',
                           'delegations','delegation_members','standings'] loop
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
  end loop;
end $$;

create trigger trg_match_squads_workflow before insert or update on public.match_squads
  for each row execute function app.guard_workflow('lineups.validate');
create trigger trg_delegations_workflow before insert or update on public.delegations
  for each row execute function app.guard_workflow('delegations.validate');
create trigger trg_match_squads_history after insert or update on public.match_squads
  for each row execute function app.track_status();
create trigger trg_delegations_history after insert or update on public.delegations
  for each row execute function app.track_status();

create or replace function app.track_lineup_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.approval_history (club_id, entity_type, entity_id, from_status, to_status, actor_id)
    values (new.club_id, 'lineups', new.id, case when tg_op = 'UPDATE' then old.status::text end, new.status::text, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger trg_lineups_history after insert or update on public.lineups
  for each row execute function app.track_lineup_status();

-- Notifications : convocation publiée (staff + joueuses convoquées ayant un compte),
-- délégation soumise, composition soumise à validation.
create or replace function app.notify_competition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select 'vs ' || o.name || ' — ' || to_char(m.kickoff_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY')
    into v_title
  from public.matches m join public.opponents o on o.id = m.opponent_id
  where m.id = new.match_id;

  if tg_table_name = 'match_squads' and new.status = 'publie' and (tg_op = 'INSERT' or old.status is distinct from 'publie') then
    perform app.notify_staff(new.club_id, 'convocation', 'Convocation publiée', v_title, '/competition/rencontres/' || new.match_id || '/convocations');
    insert into public.notifications (club_id, user_id, kind, title, body, link)
    select new.club_id, p.profile_id, 'convocation', 'Vous êtes convoquée', v_title, '/espace-joueuse'
    from public.match_squad_players sp join public.players p on p.id = sp.player_id
    where sp.squad_id = new.id and sp.status = 'convoquee' and p.profile_id is not null;
  elsif tg_table_name = 'delegations' and new.status = 'soumis' and (tg_op = 'INSERT' or old.status is distinct from 'soumis') then
    perform app.notify_staff(new.club_id, 'delegation', 'Délégation à valider', v_title, '/competition/rencontres/' || new.match_id || '/delegation');
  end if;
  return new;
end;
$$;
create trigger trg_match_squads_notify after insert or update on public.match_squads
  for each row execute function app.notify_competition();
create trigger trg_delegations_notify after insert or update on public.delegations
  for each row execute function app.notify_competition();

-- ----------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['match_squads','match_squad_players','lineups','lineup_players','lineup_snapshots',
                           'match_events','delegations','delegation_members','standings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Convocations : gérées avec « matches.write » ; joueuse = sa propre ligne une fois publiée.
-- Fonctions SECURITY DEFINER : évitent la récursion entre les politiques des deux tables.
create or replace function app.squad_published(p_squad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.match_squads where id = p_squad and status = 'publie') $$;
create or replace function app.in_my_squad(p_squad uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.match_squad_players
                     where squad_id = p_squad and player_id = app.my_player_id()) $$;
grant execute on function app.squad_published(uuid) to authenticated;
grant execute on function app.in_my_squad(uuid) to authenticated;

create policy match_squads_select on public.match_squads for select to authenticated
  using (app.has_permission(club_id, 'matches.read') or (status = 'publie' and app.in_my_squad(id)));
create policy match_squads_insert on public.match_squads for insert to authenticated
  with check (app.has_permission(club_id, 'matches.write'));
create policy match_squads_update on public.match_squads for update to authenticated
  using (app.has_permission(club_id, 'matches.write')) with check (app.has_permission(club_id, 'matches.write'));
create policy match_squads_delete on public.match_squads for delete to authenticated
  using (app.has_permission(club_id, 'lineups.validate'));

create policy squad_players_select on public.match_squad_players for select to authenticated
  using (app.has_permission(club_id, 'matches.read')
         or (player_id = app.my_player_id() and app.squad_published(squad_id)));
create policy squad_players_insert on public.match_squad_players for insert to authenticated
  with check (app.has_permission(club_id, 'matches.write'));
create policy squad_players_update on public.match_squad_players for update to authenticated
  using (app.has_permission(club_id, 'matches.write')) with check (app.has_permission(club_id, 'matches.write'));
create policy squad_players_delete on public.match_squad_players for delete to authenticated
  using (app.has_permission(club_id, 'matches.write'));

-- Les commentaires confidentiels ne sont lisibles qu'avec lineups.read_draft :
-- la colonne est retirée des droits de lecture génériques et servie par une fonction.
revoke select on public.match_squad_players from authenticated;
grant select (id, club_id, squad_id, player_id, status, shirt_number, created_at, updated_at)
  on public.match_squad_players to authenticated;

create or replace function public.squad_confidential_comments(p_squad uuid)
returns table (player_id uuid, confidential_comment text)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.player_id, sp.confidential_comment
  from public.match_squad_players sp
  where sp.squad_id = p_squad and app.has_permission(sp.club_id, 'lineups.read_draft');
$$;
revoke execute on function public.squad_confidential_comments(uuid) from public, anon;
grant execute on function public.squad_confidential_comments(uuid) to authenticated;

-- Compositions.
-- Condition évaluée sur les colonnes de la ligne (et non par relecture de la table),
-- pour rester valable dans un INSERT … RETURNING.
create policy lineups_select on public.lineups for select to authenticated
  using (app.has_permission(club_id, 'lineups.read_draft')
         or (status = 'communiquee'
             and (app.has_permission(club_id, 'matches.read')
                  or (app.my_player_id() is not null and app.is_club_member(club_id)))));
create policy lineups_insert on public.lineups for insert to authenticated
  with check (app.has_permission(club_id, 'lineups.write'));
create policy lineups_update on public.lineups for update to authenticated
  using (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'))
  with check (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'));
create policy lineups_delete on public.lineups for delete to authenticated
  using ((status = 'provisoire' and app.has_permission(club_id, 'lineups.write')) or app.has_permission(club_id, 'lineups.validate'));

create policy lineup_players_select on public.lineup_players for select to authenticated
  using (app.can_read_lineup(lineup_id));
create policy lineup_players_insert on public.lineup_players for insert to authenticated
  with check (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'));
create policy lineup_players_update on public.lineup_players for update to authenticated
  using (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'))
  with check (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'));
create policy lineup_players_delete on public.lineup_players for delete to authenticated
  using (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'));

create policy lineup_snapshots_select on public.lineup_snapshots for select to authenticated
  using (app.has_permission(club_id, 'lineups.read_draft'));
create policy lineup_snapshots_insert on public.lineup_snapshots for insert to authenticated
  with check (app.has_permission(club_id, 'lineups.write') or app.has_permission(club_id, 'lineups.validate'));

-- Événements et classement : gestion des rencontres.
do $$
declare t text;
begin
  foreach t in array array['match_events','standings'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'matches.read'))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'matches.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'matches.write')) with check (app.has_permission(club_id, 'matches.write'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'matches.write'))$f$, t);
  end loop;
end $$;

-- Délégations : lecture par les personnes ayant accès aux rencontres ; écriture « delegations.write ».
create policy delegations_select on public.delegations for select to authenticated
  using (app.has_permission(club_id, 'matches.read'));
create policy delegations_insert on public.delegations for insert to authenticated
  with check (app.has_permission(club_id, 'delegations.write'));
create policy delegations_update on public.delegations for update to authenticated
  using (app.has_permission(club_id, 'delegations.write') or app.has_permission(club_id, 'delegations.validate'))
  with check (app.has_permission(club_id, 'delegations.write') or app.has_permission(club_id, 'delegations.validate'));
create policy delegations_delete on public.delegations for delete to authenticated
  using (app.has_permission(club_id, 'delegations.validate'));

create policy delegation_members_select on public.delegation_members for select to authenticated
  using (app.has_permission(club_id, 'matches.read'));
create policy delegation_members_insert on public.delegation_members for insert to authenticated
  with check (app.has_permission(club_id, 'delegations.write'));
create policy delegation_members_update on public.delegation_members for update to authenticated
  using (app.has_permission(club_id, 'delegations.write')) with check (app.has_permission(club_id, 'delegations.write'));
create policy delegation_members_delete on public.delegation_members for delete to authenticated
  using (app.has_permission(club_id, 'delegations.write'));

-- Une délégation validée n'est plus modifiable (membres compris) sans valideur.
create or replace function app.guard_delegation_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  select status::text, club_id into v_status, v_club from public.delegations where id = coalesce(new.delegation_id, old.delegation_id);
  if v_status in ('valide', 'publie', 'archive') and not app.has_permission(v_club, 'delegations.validate') then
    raise exception 'Délégation validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_delegation_members_guard before insert or update or delete on public.delegation_members
  for each row execute function app.guard_delegation_members();

-- Convocation validée : la liste n'est plus modifiable sans valideur.
create or replace function app.guard_squad_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  if (select auth.uid()) is null then return coalesce(new, old); end if;
  select status::text, club_id into v_status, v_club from public.match_squads where id = coalesce(new.squad_id, old.squad_id);
  if v_status in ('valide', 'publie', 'archive') and not app.has_permission(v_club, 'lineups.validate') then
    raise exception 'Convocation validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_squad_players_guard before insert or update or delete on public.match_squad_players
  for each row execute function app.guard_squad_players();
