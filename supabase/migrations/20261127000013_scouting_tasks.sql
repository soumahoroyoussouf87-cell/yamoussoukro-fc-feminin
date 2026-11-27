-- =============================================================================
-- Migration 013 — Phase 3 (livraison 4) : analyse des adversaires et tâches du staff
-- Analyse des adversaires : fiches d'observation par adversaire (et par match),
-- faits observés séparés des interprétations, plan de jeu proposé. Confidentiel :
-- réservé au staff technique (evaluations.read / evaluations.write).
-- Tâches du staff : attribution à un membre du staff, échéance, priorité, statut,
-- notification de la personne désignée. Visibles par tout le staff du club.
-- Les rapports (Phase 3) sont générés à la volée à partir des données validées :
-- aucune table n'est nécessaire.
-- =============================================================================

-- ----------------------------------------------------------------- Analyse des adversaires
create table public.opponent_scouting (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  opponent_id      uuid not null references public.opponents(id) on delete cascade,
  match_id         uuid references public.matches(id) on delete set null,
  observed_on      date not null,
  source           text not null default 'video' check (source in ('video', 'direct', 'rapport', 'statistiques', 'autre')),
  source_detail    text check (length(source_detail) <= 300),
  usual_system     text check (length(usual_system) <= 40),
  in_possession    text check (length(in_possession) <= 3000),
  out_possession   text check (length(out_possession) <= 3000),
  transitions      text check (length(transitions) <= 3000),
  set_pieces       text check (length(set_pieces) <= 3000),
  key_players      text check (length(key_players) <= 3000),
  strengths        text check (length(strengths) <= 3000),
  weaknesses       text check (length(weaknesses) <= 3000),
  interpretation   text check (length(interpretation) <= 3000),
  game_plan        text check (length(game_plan) <= 3000),
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index opponent_scouting_idx on public.opponent_scouting(club_id, opponent_id, observed_on desc);

-- ----------------------------------------------------------------- Tâches du staff
create table public.staff_tasks (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  title                text not null check (length(trim(title)) between 2 and 160),
  description          text check (length(description) <= 2000),
  assignee_staff_id    uuid references public.staff_members(id) on delete set null,
  due_on               date,
  priority             text not null default 'normale' check (priority in ('basse', 'normale', 'haute')),
  status               text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'terminee', 'annulee')),
  match_id             uuid references public.matches(id) on delete set null,
  training_session_id  uuid references public.training_sessions(id) on delete set null,
  completed_at         timestamptz,
  created_by           uuid references auth.users(id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index staff_tasks_idx on public.staff_tasks(club_id, status, due_on);

-- ----------------------------------------------------------------- Gardes
create or replace function app.guard_scouting_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'opponent_scouting' then
    if not exists (select 1 from public.opponents o where o.id = new.opponent_id and o.club_id = new.club_id) then
      raise exception 'Adversaire d''un autre club.' using errcode = '23514';
    end if;
    if new.match_id is not null and not exists (
      select 1 from public.matches m where m.id = new.match_id and m.club_id = new.club_id and m.opponent_id = new.opponent_id) then
      raise exception 'Ce match n''oppose pas l''équipe à cet adversaire.' using errcode = '23514';
    end if;
  else
    if new.assignee_staff_id is not null and not exists (select 1 from public.staff_members s where s.id = new.assignee_staff_id and s.club_id = new.club_id) then
      raise exception 'Membre du staff d''un autre club.' using errcode = '23514';
    end if;
    if new.match_id is not null and not exists (select 1 from public.matches m where m.id = new.match_id and m.club_id = new.club_id) then
      raise exception 'Match d''un autre club.' using errcode = '23514';
    end if;
    if new.training_session_id is not null and not exists (select 1 from public.training_sessions t where t.id = new.training_session_id and t.club_id = new.club_id) then
      raise exception 'Séance d''un autre club.' using errcode = '23514';
    end if;
    if new.status = 'terminee' and (tg_op = 'INSERT' or old.status <> 'terminee') then
      new.completed_at := now();
    elsif new.status <> 'terminee' then
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- Notification de la personne désignée (attribution ou changement d'attribution).
create or replace function app.notify_staff_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.assignee_staff_id is null or (tg_op = 'UPDATE' and new.assignee_staff_id is not distinct from old.assignee_staff_id) then
    return new;
  end if;
  select profile_id into v_user from public.staff_members where id = new.assignee_staff_id;
  if v_user is not null and v_user is distinct from (select auth.uid()) then
    insert into public.notifications (club_id, user_id, kind, title, body, link)
    values (new.club_id, v_user, 'tache', 'Nouvelle tâche',
            new.title || coalesce(' — échéance ' || to_char(new.due_on, 'DD/MM/YYYY'), ''), '/taches');
  end if;
  return new;
end;
$$;

-- La personne désignée ou l'auteur peut modifier la tâche ; staff.write en plus pour tout le club.
create or replace function app.can_edit_task(p_club uuid, p_assignee uuid, p_creator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_club_staff(p_club) and (
    p_creator = (select auth.uid())
    or exists (select 1 from public.staff_members s where s.id = p_assignee and s.profile_id = (select auth.uid()))
    or app.has_permission(p_club, 'staff.write')
    or app.has_permission(p_club, 'planning.write')
  );
$$;
revoke all on function app.can_edit_task(uuid, uuid, uuid) from public, anon;
grant execute on function app.can_edit_task(uuid, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------- Triggers, RLS
do $$
declare t text;
begin
  foreach t in array array['opponent_scouting', 'staff_tasks'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                      for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
                      for each row execute function app.audit_row()', t);
    execute format('create trigger trg_%1$s_guard before insert or update on public.%1$I
                      for each row execute function app.guard_scouting_tasks()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

create policy opponent_scouting_select on public.opponent_scouting for select to authenticated
  using (app.has_permission(club_id, 'evaluations.read'));
create policy opponent_scouting_insert on public.opponent_scouting for insert to authenticated
  with check (app.has_permission(club_id, 'evaluations.write'));
create policy opponent_scouting_update on public.opponent_scouting for update to authenticated
  using (app.has_permission(club_id, 'evaluations.write')) with check (app.has_permission(club_id, 'evaluations.write'));
create policy opponent_scouting_delete on public.opponent_scouting for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write'));

create policy staff_tasks_select on public.staff_tasks for select to authenticated
  using (app.is_club_staff(club_id));
create policy staff_tasks_insert on public.staff_tasks for insert to authenticated
  with check (app.is_club_staff(club_id));
create policy staff_tasks_update on public.staff_tasks for update to authenticated
  using (app.can_edit_task(club_id, assignee_staff_id, created_by))
  with check (app.is_club_staff(club_id));
create policy staff_tasks_delete on public.staff_tasks for delete to authenticated
  using (created_by = (select auth.uid()) or app.has_permission(club_id, 'staff.write') or app.has_permission(club_id, 'planning.write'));

create trigger trg_staff_tasks_notify after insert or update on public.staff_tasks
  for each row execute function app.notify_staff_task();
