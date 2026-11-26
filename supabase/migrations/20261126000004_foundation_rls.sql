-- =============================================================================
-- Migration 004 — Row Level Security et stockage privé
-- Règle : aucune table n'est lisible sans politique explicite. Le rôle « anon »
-- n'a accès à rien. Les permissions viennent exclusivement de user_roles.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'clubs','teams','seasons','competitions','profiles','roles','permissions','role_permissions','user_roles',
    'positions','players','player_seasons','player_positions','player_documents','player_availability',
    'staff_members','opponents','matches','application_settings','notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke all on public.player_current_availability from anon;

-- Le journal d'audit n'est jamais modifiable depuis l'API.
revoke insert, update, delete, truncate on public.audit_logs from authenticated;

-- Raccourci : identifiant de la joueuse liée au compte connecté.
create or replace function app.my_player_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.players where profile_id = (select auth.uid()) $$;
grant execute on function app.my_player_id() to authenticated;

-- ---------------------------------------------------------------- Institution
create policy clubs_select on public.clubs for select to authenticated
  using (app.is_club_member(id));
create policy clubs_update on public.clubs for update to authenticated
  using (app.has_permission(id, 'settings.manage')) with check (app.has_permission(id, 'settings.manage'));

do $$
declare t text;
begin
  foreach t in array array['teams','seasons','competitions'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.is_club_member(club_id))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'settings.manage'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'settings.manage')) with check (app.has_permission(club_id, 'settings.manage'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'settings.manage'))$f$, t);
  end loop;
end $$;

create policy settings_select on public.application_settings for select to authenticated
  using (app.is_club_member(club_id));
create policy settings_insert on public.application_settings for insert to authenticated
  with check (app.has_permission(club_id, 'settings.manage'));
create policy settings_update on public.application_settings for update to authenticated
  using (app.has_permission(club_id, 'settings.manage')) with check (app.has_permission(club_id, 'settings.manage'));

-- ------------------------------------------------------------------- Profils
create or replace function app.can_view_profile(p_profile uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_profile = (select auth.uid())
      or exists (
        select 1 from public.user_roles target
        where target.user_id = p_profile and target.revoked_at is null
          and app.is_club_staff(target.club_id)
      );
$$;
grant execute on function app.can_view_profile(uuid) to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (app.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- L'adresse e-mail du profil est un miroir d'auth.users : non modifiable par l'utilisateur.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_path, theme, locale) on public.profiles to authenticated;

-- ------------------------------------------------- Rôles et permissions
create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy positions_select on public.positions for select to authenticated using (true);
-- Aucune politique d'écriture : la matrice évolue par migration versionnée.

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or app.has_permission(club_id, 'users.manage'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (app.has_permission(club_id, 'users.manage'));
create policy user_roles_update on public.user_roles for update to authenticated
  using (app.has_permission(club_id, 'users.manage')) with check (app.has_permission(club_id, 'users.manage'));
-- Pas de DELETE : on révoque (revoked_at) pour conserver l'historique.

-- -------------------------------------------------------------- Effectif
create policy players_select on public.players for select to authenticated
  using (app.has_permission(club_id, 'players.read') or profile_id = (select auth.uid()));
create policy players_insert on public.players for insert to authenticated
  with check (app.has_permission(club_id, 'players.write'));
create policy players_update on public.players for update to authenticated
  using (app.has_permission(club_id, 'players.write')) with check (app.has_permission(club_id, 'players.write'));
create policy players_delete on public.players for delete to authenticated
  using (app.has_permission(club_id, 'players.delete'));

do $$
declare t text;
begin
  foreach t in array array['player_seasons','player_positions'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app.has_permission(club_id, 'players.read') or player_id = app.my_player_id())$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
      with check (app.has_permission(club_id, 'players.write'))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
      using (app.has_permission(club_id, 'players.write')) with check (app.has_permission(club_id, 'players.write'))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$I for delete to authenticated
      using (app.has_permission(club_id, 'players.write'))$f$, t);
  end loop;
end $$;

create policy player_documents_select on public.player_documents for select to authenticated
  using (app.has_permission(club_id, 'players.documents.read') or player_id = app.my_player_id());
create policy player_documents_insert on public.player_documents for insert to authenticated
  with check (app.has_permission(club_id, 'players.documents.write'));
create policy player_documents_update on public.player_documents for update to authenticated
  using (app.has_permission(club_id, 'players.documents.write')) with check (app.has_permission(club_id, 'players.documents.write'));
create policy player_documents_delete on public.player_documents for delete to authenticated
  using (app.has_permission(club_id, 'players.documents.write'));

create policy availability_select on public.player_availability for select to authenticated
  using (app.has_permission(club_id, 'availability.read') or player_id = app.my_player_id());
create policy availability_insert on public.player_availability for insert to authenticated
  with check (app.has_permission(club_id, 'availability.write'));
create policy availability_update on public.player_availability for update to authenticated
  using (app.has_permission(club_id, 'availability.write')) with check (app.has_permission(club_id, 'availability.write'));
create policy availability_delete on public.player_availability for delete to authenticated
  using (app.has_permission(club_id, 'availability.write'));

-- ------------------------------------------------------------------ Staff
create policy staff_select on public.staff_members for select to authenticated
  using (app.has_permission(club_id, 'staff.read') or profile_id = (select auth.uid()));
create policy staff_insert on public.staff_members for insert to authenticated
  with check (app.has_permission(club_id, 'staff.write'));
create policy staff_update on public.staff_members for update to authenticated
  using (app.has_permission(club_id, 'staff.write')) with check (app.has_permission(club_id, 'staff.write'));
create policy staff_delete on public.staff_members for delete to authenticated
  using (app.has_permission(club_id, 'staff.write'));

-- ------------------------------------------------------------ Compétition
do $$
declare t text;
begin
  foreach t in array array['opponents','matches'] loop
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

-- ---------------------------------------------- Notifications et audit
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy audit_select on public.audit_logs for select to authenticated
  using (club_id is not null and app.has_permission(club_id, 'audit.read'));

-- =============================================================================
-- Stockage privé (aucun bucket public). Chemins : {club_id}/{entité}/{fichier}
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('club-assets',      'club-assets',      false, 10485760, array['image/png','image/svg+xml','image/jpeg','image/webp']),
  ('player-photos',    'player-photos',    false, 5242880,  array['image/png','image/jpeg','image/webp']),
  ('staff-photos',     'staff-photos',     false, 5242880,  array['image/png','image/jpeg','image/webp']),
  ('player-documents', 'player-documents', false, 15728640, array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;

create or replace function app.path_club(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function app.path_club(text) to authenticated;

create or replace function app.path_player(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(p_name, '/', 2)::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function app.path_player(text) to authenticated;

create policy club_assets_read on storage.objects for select to authenticated
  using (bucket_id = 'club-assets' and app.is_club_member(app.path_club(name)));
create policy club_assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'club-assets' and app.has_permission(app.path_club(name), 'settings.manage'));
create policy club_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'club-assets' and app.has_permission(app.path_club(name), 'settings.manage'));
create policy club_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-assets' and app.has_permission(app.path_club(name), 'settings.manage'));

create policy player_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and (
    app.has_permission(app.path_club(name), 'players.read') or app.path_player(name) = app.my_player_id()));
create policy player_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and app.has_permission(app.path_club(name), 'players.write'));
create policy player_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and app.has_permission(app.path_club(name), 'players.write'));
create policy player_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and app.has_permission(app.path_club(name), 'players.write'));

create policy staff_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'staff-photos' and app.has_permission(app.path_club(name), 'staff.read'));
create policy staff_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-photos' and app.has_permission(app.path_club(name), 'staff.write'));
create policy staff_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'staff-photos' and app.has_permission(app.path_club(name), 'staff.write'));
create policy staff_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'staff-photos' and app.has_permission(app.path_club(name), 'staff.write'));

create policy player_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'player-documents' and (
    app.has_permission(app.path_club(name), 'players.documents.read') or app.path_player(name) = app.my_player_id()));
create policy player_documents_write on storage.objects for insert to authenticated
  with check (bucket_id = 'player-documents' and app.has_permission(app.path_club(name), 'players.documents.write'));
create policy player_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'player-documents' and app.has_permission(app.path_club(name), 'players.documents.write'));

-- =============================================================================
-- Amorçage : premier administrateur. Exécutable uniquement par service_role /
-- postgres (jamais depuis le navigateur). Refuse s'il existe déjà un admin.
-- =============================================================================
create or replace function app.bootstrap_first_admin(p_email text, p_club uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_admin uuid;
begin
  select id into v_admin from public.roles where code = 'admin';
  if exists (select 1 from public.user_roles where club_id = p_club and role_id = v_admin and revoked_at is null) then
    raise exception 'Un administrateur existe déjà pour ce club.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'Aucun compte avec cette adresse. Créez ou invitez d''abord l''utilisateur.';
  end if;
  insert into public.user_roles (user_id, club_id, role_id) values (v_user, p_club, v_admin);
end;
$$;
revoke all on function app.bootstrap_first_admin(text, uuid) from public, authenticated;
grant execute on function app.bootstrap_first_admin(text, uuid) to service_role;

grant usage on schema app to authenticated;
