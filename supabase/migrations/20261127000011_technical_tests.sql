-- =============================================================================
-- Migration 011 — Phase 3 (livraison 2) : tests techniques standardisés (§21)
-- Protocoles versionnés (conditions, tentatives, barème), séances de tests,
-- résultats (tentatives, réussites, erreurs, temps). Chaque résultat garde une
-- copie du protocole utilisé : on ne compare que des résultats obtenus avec la
-- même version du protocole, et un changement de barème ne réécrit jamais
-- l'historique. Les tests alimentent la source « Tests » (20 %) de la technique.
-- Aucune donnée sportive fictive : seuls les 12 protocoles du cahier des
-- charges sont proposés, avec des conditions types modifiables par le staff.
-- =============================================================================

create table public.technical_test_protocols (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  code             text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  name             text not null check (length(trim(name)) between 2 and 120),
  objective        text check (length(objective) <= 500),
  setup            text not null check (length(trim(setup)) between 5 and 2000),
  measure          text not null check (measure in ('reussite', 'temps')),
  attempts         smallint not null check (attempts between 1 and 100),
  -- Barème des tests chronométrés (secondes) : ref_best = 100, ref_limit = 0.
  ref_best         numeric(7,2) check (ref_best > 0),
  ref_limit        numeric(7,2) check (ref_limit > 0),
  criterion_codes  text[] not null default '{}',
  version_no       smallint not null default 1 check (version_no >= 1),
  active           boolean not null default true,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (club_id, code),
  check ((ref_best is null) = (ref_limit is null)),
  check (ref_best is null or ref_best < ref_limit),
  check (measure = 'temps' or ref_best is null)
);

create table public.technical_test_sessions (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  season_id            uuid references public.seasons(id) on delete set null,
  training_session_id  uuid references public.training_sessions(id) on delete set null,
  tested_on            date not null,
  title                text not null check (length(trim(title)) between 2 and 160),
  location             text check (length(location) <= 160),
  conditions           text check (length(conditions) <= 1000),
  notes                text check (length(notes) <= 2000),
  protocol_ids         uuid[] not null default '{}',
  player_ids           uuid[] not null default '{}',
  status               public.workflow_status not null default 'brouillon',
  validated_by         uuid references auth.users(id) on delete set null,
  validated_at         timestamptz,
  published_at         timestamptz,
  created_by           uuid references auth.users(id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (cardinality(protocol_ids) <= 12),
  check (cardinality(player_ids) <= 60)
);
create index technical_test_sessions_club_idx on public.technical_test_sessions(club_id, tested_on desc);

create table public.technical_test_results (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  test_session_id   uuid not null references public.technical_test_sessions(id) on delete cascade,
  protocol_id       uuid not null references public.technical_test_protocols(id) on delete restrict,
  player_id         uuid not null references public.players(id) on delete cascade,
  attempts          smallint check (attempts between 1 and 100),
  successes         smallint check (successes >= 0),
  errors            smallint check (errors >= 0),
  value_seconds     numeric(7,2) check (value_seconds > 0 and value_seconds < 3600),
  notes             text check (length(notes) <= 500),
  -- Copie du protocole au moment de la mesure (remplie par la base).
  protocol_version  smallint not null default 1,
  measure           text not null default 'reussite' check (measure in ('reussite', 'temps')),
  ref_best          numeric(7,2),
  ref_limit         numeric(7,2),
  criterion_codes   text[] not null default '{}',
  index_value       numeric(5,1) check (index_value between 0 and 100),
  recorded_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (test_session_id, protocol_id, player_id),
  check (successes is null or attempts is null or successes <= attempts),
  check (errors is null or attempts is null or errors <= attempts)
);
create index technical_test_results_player_idx on public.technical_test_results(player_id, protocol_id);

-- ----------------------------------------------------------------- Gardes
-- Toute modification des conditions ou du barème crée une nouvelle version du protocole.
create or replace function app.version_test_protocol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code <> old.code then
    raise exception 'Le code d''un protocole ne change pas.' using errcode = '23514';
  end if;
  if (new.setup, new.measure, new.attempts, new.ref_best, new.ref_limit, new.criterion_codes)
     is distinct from (old.setup, old.measure, old.attempts, old.ref_best, old.ref_limit, old.criterion_codes) then
    new.version_no := old.version_no + 1;
  else
    new.version_no := old.version_no;
  end if;
  return new;
end;
$$;

-- Copie du protocole et calcul de l'indice (0-100) de chaque résultat.
create or replace function app.compute_test_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.technical_test_protocols;
  v_status text;
  v_session_club uuid;
begin
  select status::text, club_id into v_status, v_session_club from public.technical_test_sessions where id = new.test_session_id;
  select * into p from public.technical_test_protocols where id = new.protocol_id;
  if p.id is null or p.club_id <> new.club_id or v_session_club is distinct from new.club_id
     or not exists (select 1 from public.players pl where pl.id = new.player_id and pl.club_id = new.club_id) then
    raise exception 'Résultat incohérent (club).' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.protocol_id <> old.protocol_id or new.player_id <> old.player_id or new.test_session_id <> old.test_session_id) then
    raise exception 'Protocole, joueuse et séance d''un résultat ne changent pas.' using errcode = '23514';
  end if;
  -- Tant que la séance n'est pas validée, le résultat suit la version courante du protocole.
  if tg_op = 'INSERT' or v_status in ('brouillon', 'soumis') then
    new.protocol_version := p.version_no;
    new.measure := p.measure;
    new.ref_best := p.ref_best;
    new.ref_limit := p.ref_limit;
    new.criterion_codes := p.criterion_codes;
  else
    new.protocol_version := old.protocol_version;
    new.measure := old.measure;
    new.ref_best := old.ref_best;
    new.ref_limit := old.ref_limit;
    new.criterion_codes := old.criterion_codes;
  end if;
  if new.measure = 'reussite' then
    new.value_seconds := null;
    new.index_value := case when new.attempts > 0 and new.successes is not null
      then round(new.successes::numeric * 100 / new.attempts, 1) end;
  else
    new.index_value := case when new.value_seconds is not null and new.ref_best is not null
      then round(greatest(0, least(1, (new.ref_limit - new.value_seconds) / (new.ref_limit - new.ref_best))) * 100, 1) end;
  end if;
  return new;
end;
$$;

-- Résultats d'une séance validée : modifiables seulement par evaluations.validate.
create or replace function app.guard_test_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_club uuid;
begin
  select status::text, club_id into v_status, v_club from public.technical_test_sessions
  where id = coalesce(new.test_session_id, old.test_session_id);
  if (select auth.uid()) is not null and v_status in ('valide', 'publie', 'archive')
     and not app.has_permission(v_club, 'evaluations.validate') then
    raise exception 'Séance de tests validée : modification réservée aux personnes autorisées.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Protocoles et joueuses d'une séance : du même club.
create or replace function app.guard_test_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.protocol_ids) x(id)
             where not exists (select 1 from public.technical_test_protocols p where p.id = x.id and p.club_id = new.club_id)) then
    raise exception 'Protocole d''un autre club.' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(new.player_ids) x(id)
             where not exists (select 1 from public.players p where p.id = x.id and p.club_id = new.club_id)) then
    raise exception 'Joueuse d''un autre club.' using errcode = '23514';
  end if;
  if new.training_session_id is not null
     and not exists (select 1 from public.training_sessions t where t.id = new.training_session_id and t.club_id = new.club_id) then
    raise exception 'Séance d''un autre club.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function app.notify_test_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'valide' and (tg_op = 'INSERT' or old.status is distinct from 'valide') then
    perform app.notify_staff(new.club_id, 'evaluation', 'Séance de tests validée', new.title,
                             '/performance/tests/' || new.id);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------- Triggers, RLS
do $$
declare t text;
begin
  foreach t in array array['technical_test_protocols','technical_test_sessions','technical_test_results'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'evaluations.read'))$f$, t);
  end loop;
end $$;

create policy technical_test_protocols_insert on public.technical_test_protocols for insert to authenticated
  with check (app.has_permission(club_id, 'frameworks.manage'));
create policy technical_test_protocols_update on public.technical_test_protocols for update to authenticated
  using (app.has_permission(club_id, 'frameworks.manage')) with check (app.has_permission(club_id, 'frameworks.manage'));
-- Pas de suppression : un protocole se désactive (les résultats historiques en dépendent).

create policy technical_test_sessions_insert on public.technical_test_sessions for insert to authenticated
  with check (app.has_permission(club_id, 'evaluations.write'));
create policy technical_test_sessions_update on public.technical_test_sessions for update to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))
  with check (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));
create policy technical_test_sessions_delete on public.technical_test_sessions for delete to authenticated
  using ((app.has_permission(club_id, 'evaluations.write') and status in ('brouillon', 'soumis'))
         or app.has_permission(club_id, 'evaluations.validate'));

create policy technical_test_results_insert on public.technical_test_results for insert to authenticated
  with check (app.has_permission(club_id, 'evaluations.write'));
create policy technical_test_results_update on public.technical_test_results for update to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'))
  with check (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));
create policy technical_test_results_delete on public.technical_test_results for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write') or app.has_permission(club_id, 'evaluations.validate'));

create trigger trg_technical_test_protocols_version before update on public.technical_test_protocols
  for each row execute function app.version_test_protocol();
create trigger trg_technical_test_sessions_consistency before insert or update on public.technical_test_sessions
  for each row execute function app.guard_test_session();
create trigger trg_technical_test_sessions_workflow before insert or update on public.technical_test_sessions
  for each row execute function app.guard_workflow('evaluations.validate');
create trigger trg_technical_test_sessions_history after insert or update on public.technical_test_sessions
  for each row execute function app.track_status();
create trigger trg_technical_test_sessions_notify after insert or update on public.technical_test_sessions
  for each row execute function app.notify_test_session();
create trigger trg_technical_test_results_lock before insert or update or delete on public.technical_test_results
  for each row execute function app.guard_test_results();
create trigger trg_technical_test_results_compute before insert or update on public.technical_test_results
  for each row execute function app.compute_test_result();

-- ----------------------------------------------------------------- Protocoles du cahier des charges (§21)
create or replace function app.seed_technical_tests(p_club uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.technical_test_protocols (club_id, code, name, objective, setup, measure, attempts, criterion_codes, sort_order)
  select p_club, t.code, t.name, t.objective, t.setup, t.measure, t.attempts, t.crit, t.ord
  from (values
    (1, 'passe_courte_cible', 'Passe courte sur cible', 'Précision de la passe courte, des deux pieds.',
     'Conditions types à adapter : 10 passes à 10 m vers une cible de 1 m de large (mini-but ou plots), ballon arrêté, 5 de chaque pied. Réussite = ballon dans la cible.',
     'reussite', 10, array['passe_courte','qualite_passe']),
    (2, 'passe_longue_cible', 'Passe longue sur cible', 'Précision du jeu long.',
     'Conditions types à adapter : 10 passes à 30 m dans une zone de 5 m × 5 m, ballon arrêté. Réussite = premier rebond dans la zone.',
     'reussite', 10, array['passe_longue','relance_longue']),
    (3, 'controle_oriente', 'Contrôle orienté', 'Qualité du premier contact vers l''espace libre.',
     'Conditions types à adapter : 10 ballons servis à 15 m ; contrôle orienté vers une porte de 2 m placée à 45°, côtés alternés. Réussite = ballon orienté et maîtrisé dans la porte.',
     'reussite', 10, array['controle_oriente','controle_ballon']),
    (4, 'conduite_chrono', 'Conduite chronométrée', 'Vitesse de conduite en ligne droite.',
     'Conditions types à adapter : conduite sur 30 m en ligne droite, départ arrêté, 3 essais ; on retient le meilleur temps. Ballon perdu = erreur.',
     'temps', 3, array['conduite','conduite_vitesse']),
    (5, 'slalom', 'Slalom', 'Conduite en changements de direction.',
     'Conditions types à adapter : slalom aller-retour entre 6 plots espacés de 2 m, 3 essais ; on retient le meilleur temps. Plot touché = erreur.',
     'temps', 3, array['conduite','controle_mouvement']),
    (6, 'frappe_cible', 'Frappe sur cible', 'Précision et qualité de frappe.',
     'Conditions types à adapter : 10 frappes à 18 m, ballon arrêté, sans gardienne ; cibles dans les deux coins du but. Réussite = ballon dans une cible.',
     'reussite', 10, array['frappe','finition_pied_fort']),
    (7, 'finition_une_touche', 'Finition en une touche', 'Efficacité devant le but sans contrôle.',
     'Conditions types à adapter : 10 passes en retrait servies depuis le côté, finition en une touche dans la surface, avec gardienne. Réussite = but.',
     'reussite', 10, array['finition_une_touche','finition']),
    (8, 'centre_zone', 'Centre sur zone définie', 'Précision du centre.',
     'Conditions types à adapter : 10 centres depuis le couloir après une conduite de 10 m ; zone d''arrivée entre le point de penalty et les 6 m. Réussite = ballon dans la zone.',
     'reussite', 10, array['centre']),
    (9, 'pied_faible', 'Utilisation du pied faible', 'Fiabilité technique du pied faible.',
     'Conditions types à adapter : 10 passes à 15 m sur une cible de 1 m et 5 frappes à 16 m, pied faible uniquement. Réussite = cible atteinte.',
     'reussite', 15, array['pied_faible','finition_pied_faible']),
    (10, 'duel_offensif', 'Duel offensif', 'Capacité à éliminer en 1 contre 1.',
     'Conditions types à adapter : 1 contre 1 dans un couloir de 10 m × 20 m, 10 duels. Réussite = ligne adverse franchie balle au pied.',
     'reussite', 10, array['dribble']),
    (11, 'duel_defensif', 'Duel défensif', 'Capacité à stopper l''adversaire en 1 contre 1.',
     'Conditions types à adapter : 1 contre 1 défensif dans un couloir de 10 m × 20 m, 10 duels. Réussite = ballon récupéré ou sorti du couloir.',
     'reussite', 10, array['duel_defensif','tacle_interception','tacle']),
    (12, 'conservation_pression', 'Conservation sous pression', 'Protection du ballon sous pression.',
     'Conditions types à adapter : conservation pendant 10 s face à une ou deux joueuses dans un carré de 8 m, 10 répétitions. Réussite = ballon conservé.',
     'reussite', 10, array['protection','sous_pression','relance_pression'])
  ) as t(ord, code, name, objective, setup, measure, attempts, crit)
  on conflict (club_id, code) do nothing;
$$;
revoke all on function app.seed_technical_tests(uuid) from public, authenticated;

create or replace function app.on_club_created_seed_tests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.seed_technical_tests(new.id);
  return new;
end;
$$;
create trigger trg_clubs_seed_tests after insert on public.clubs
  for each row execute function app.on_club_created_seed_tests();

select app.seed_technical_tests(id) from public.clubs;
