-- =============================================================================
-- Migration 015 — Phase 4 (livraison 1) : plans de développement (PDI)
-- Plans individuels, sectoriels et collectifs ; objectifs mesurables (point de
-- départ, cible, échéance), exercices correctifs reliés à la bibliothèque,
-- réévaluations datées (faits et interprétation séparés, décision, résultat par
-- objectif). Le point de départ et la mesure actuelle d'un objectif relié à un
-- critère d'évaluation sont lus dans les évaluations validées (pas de copie).
-- Réservé au staff : development.read / development.write.
-- =============================================================================

create table public.development_plans (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  scope           text not null check (scope in ('individuel', 'sectoriel', 'collectif')),
  player_id       uuid references public.players(id) on delete cascade,
  sector_code     text check (sector_code in ('gardiennes','defense','milieu','attaque','couloir_droit','couloir_gauche','axe_central')),
  title           text not null check (length(trim(title)) between 2 and 160),
  starts_on       date not null,
  ends_on         date not null,
  status          text not null default 'actif' check (status in ('actif', 'termine', 'abandonne')),
  owner_staff_id  uuid references public.staff_members(id) on delete set null,
  findings        text check (length(findings) <= 3000),
  analysis        text check (length(analysis) <= 3000),
  next_review_on  date,
  closed_at       timestamptz,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on),
  check ((scope = 'individuel') = (player_id is not null)),
  check ((scope = 'sectoriel') = (sector_code is not null))
);
create index development_plans_idx on public.development_plans(club_id, status, scope);
create index development_plans_player_idx on public.development_plans(player_id) where player_id is not null;

create table public.development_objectives (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  plan_id        uuid not null references public.development_plans(id) on delete cascade,
  label          text not null check (length(trim(label)) between 2 and 200),
  dimension      text check (dimension in ('technique','tactique','athletique','cognitive','mentale','comportementale','collectif')),
  criterion_code text check (criterion_code ~ '^[a-z0-9_]{2,60}$'),
  measure        text check (length(measure) <= 300),
  baseline       numeric(7,2),
  target         numeric(7,2),
  unit           text check (length(unit) <= 20),
  due_on         date,
  priority       text not null default 'normale' check (priority in ('basse', 'normale', 'haute')),
  status         text not null default 'en_cours' check (status in ('en_cours', 'atteint', 'partiel', 'non_atteint', 'abandonne')),
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index development_objectives_plan_idx on public.development_objectives(plan_id, sort_order);

-- Exercices correctifs : exercice de la bibliothèque ou consigne libre.
create table public.development_actions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  objective_id  uuid not null references public.development_objectives(id) on delete cascade,
  exercise_id   uuid references public.exercises(id) on delete set null,
  label         text not null check (length(trim(label)) between 2 and 200),
  frequency     text check (length(frequency) <= 80),
  notes         text check (length(notes) <= 1000),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index development_actions_objective_idx on public.development_actions(objective_id, sort_order);
create index development_actions_exercise_idx on public.development_actions(exercise_id) where exercise_id is not null;

create table public.development_reviews (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  plan_id         uuid not null references public.development_plans(id) on delete cascade,
  reviewed_on     date not null,
  facts           text check (length(facts) <= 3000),
  interpretation  text check (length(interpretation) <= 3000),
  decision        text not null check (decision in ('poursuivre', 'ajuster', 'prolonger', 'cloturer')),
  next_review_on  date,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (next_review_on is null or next_review_on > reviewed_on)
);
create index development_reviews_plan_idx on public.development_reviews(plan_id, reviewed_on desc);

create table public.development_review_items (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  review_id     uuid not null references public.development_reviews(id) on delete cascade,
  objective_id  uuid not null references public.development_objectives(id) on delete cascade,
  value         numeric(7,2),
  status        text not null check (status in ('en_cours', 'atteint', 'partiel', 'non_atteint', 'abandonne')),
  comment       text check (length(comment) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (review_id, objective_id)
);

-- ----------------------------------------------------------------- Gardes
create or replace function app.guard_development()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'development_plans' then
    if new.player_id is not null and not exists (select 1 from public.players p where p.id = new.player_id and p.club_id = new.club_id) then
      raise exception 'Joueuse d''un autre club.' using errcode = '23514';
    end if;
    if new.owner_staff_id is not null and not exists (select 1 from public.staff_members s where s.id = new.owner_staff_id and s.club_id = new.club_id) then
      raise exception 'Responsable d''un autre club.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and (new.scope, new.player_id, new.sector_code) is distinct from (old.scope, old.player_id, old.sector_code) then
      raise exception 'La portée d''un plan ne change pas : créez un nouveau plan.' using errcode = '23514';
    end if;
    if new.status <> 'actif' and (tg_op = 'INSERT' or old.status = 'actif') then
      new.closed_at := now();
    elsif new.status = 'actif' then
      new.closed_at := null;
    end if;
  elsif tg_table_name = 'development_objectives' then
    if not exists (select 1 from public.development_plans p where p.id = new.plan_id and p.club_id = new.club_id) then
      raise exception 'Plan d''un autre club.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.plan_id <> old.plan_id then
      raise exception 'Un objectif ne change pas de plan.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'development_actions' then
    if not exists (select 1 from public.development_objectives o where o.id = new.objective_id and o.club_id = new.club_id) then
      raise exception 'Objectif d''un autre club.' using errcode = '23514';
    end if;
    if new.exercise_id is not null and not exists (select 1 from public.exercises e where e.id = new.exercise_id and e.club_id = new.club_id) then
      raise exception 'Exercice d''un autre club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'development_reviews' then
    if not exists (select 1 from public.development_plans p where p.id = new.plan_id and p.club_id = new.club_id) then
      raise exception 'Plan d''un autre club.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'development_review_items' then
    if not exists (
      select 1 from public.development_reviews r join public.development_objectives o on o.plan_id = r.plan_id
      where r.id = new.review_id and o.id = new.objective_id and r.club_id = new.club_id) then
      raise exception 'Objectif hors du plan de cette réévaluation.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Une réévaluation met à jour le plan : prochaine échéance, clôture éventuelle.
create or replace function app.apply_development_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Seule la réévaluation la plus récente fait foi.
  if exists (select 1 from public.development_reviews r where r.plan_id = new.plan_id and r.id <> new.id
             and (r.reviewed_on > new.reviewed_on or (r.reviewed_on = new.reviewed_on and r.created_at > new.created_at))) then
    return new;
  end if;
  update public.development_plans
     set next_review_on = new.next_review_on,
         status = case when new.decision = 'cloturer' then 'termine' else status end
   where id = new.plan_id;
  return new;
end;
$$;

-- Le statut d'un objectif suit sa dernière réévaluation.
create or replace function app.apply_development_review_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_created timestamptz;
begin
  select reviewed_on, created_at into v_date, v_created from public.development_reviews where id = new.review_id;
  if not exists (
    select 1 from public.development_review_items i join public.development_reviews r on r.id = i.review_id
    where i.objective_id = new.objective_id and i.id <> new.id
      and (r.reviewed_on > v_date or (r.reviewed_on = v_date and r.created_at > v_created))) then
    update public.development_objectives set status = new.status where id = new.objective_id;
  end if;
  return new;
end;
$$;

-- Notification du responsable désigné.
create or replace function app.notify_development_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.owner_staff_id is null or (tg_op = 'UPDATE' and new.owner_staff_id is not distinct from old.owner_staff_id) then
    return new;
  end if;
  select profile_id into v_user from public.staff_members where id = new.owner_staff_id;
  if v_user is not null and v_user is distinct from (select auth.uid()) then
    insert into public.notifications (club_id, user_id, kind, title, body, link)
    values (new.club_id, v_user, 'developpement', 'Plan de développement confié', new.title, '/developpement/' || new.id);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------- Triggers, RLS
do $$
declare t text;
begin
  foreach t in array array['development_plans','development_objectives','development_actions','development_reviews','development_review_items'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('create trigger trg_%1$s_guard before insert or update on public.%1$I
                      for each row execute function app.guard_development()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'development.read'))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'development.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'development.write')) with check (app.has_permission(club_id, 'development.write'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'development.write'))$f$, t);
  end loop;
end $$;

create trigger trg_development_reviews_apply after insert or update on public.development_reviews
  for each row execute function app.apply_development_review();
create trigger trg_development_review_items_apply after insert or update on public.development_review_items
  for each row execute function app.apply_development_review_item();
create trigger trg_development_plans_notify after insert or update on public.development_plans
  for each row execute function app.notify_development_owner();

-- Réévaluation et résultats par objectif enregistrés ensemble (tout ou rien). Droits de l'appelant (RLS).
create or replace function public.add_development_review(p_plan uuid, p_review jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club uuid;
  v_id uuid;
begin
  select club_id into v_club from public.development_plans where id = p_plan;
  if v_club is null then raise exception 'Plan introuvable.' using errcode = 'P0002'; end if;
  insert into public.development_reviews (club_id, plan_id, reviewed_on, facts, interpretation, decision, next_review_on)
  values (v_club, p_plan, (p_review->>'reviewed_on')::date, p_review->>'facts', p_review->>'interpretation',
          p_review->>'decision', (p_review->>'next_review_on')::date)
  returning id into v_id;
  insert into public.development_review_items (club_id, review_id, objective_id, value, status, comment)
  select v_club, v_id, (i->>'objective_id')::uuid, (i->>'value')::numeric, i->>'status', i->>'comment'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i;
  return v_id;
end;
$$;
revoke all on function public.add_development_review(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.add_development_review(uuid, jsonb, jsonb) to authenticated;
