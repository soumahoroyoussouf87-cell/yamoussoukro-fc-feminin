-- Jeu de données de RECETTE LOCALE uniquement (jamais appliqué en production).
-- Prérequis : utilisateurs coach/adjoint/comm/tm créés par le script de recette.
do $$
declare
  c uuid := '6f1d6a3e-0000-4000-8000-000000000001';
  t uuid := '6f1d6a3e-0000-4000-8000-000000000002';
  s uuid; comp uuid; p uuid; i int;
  names text[] := array['Kouassi','Traoré','Koné','Yao','Bamba','Diabaté','Ouattara','Coulibaly','N''Guessan','Konan','Touré','Diallo','Kouamé','Sangaré','Aka','Gnagne','Doumbia','Fofana','Tanoh','Assi','Brou','Kipré'];
  pos text[] := array['GB','DD','DC','DC','DG','N6','N8','N8','AD','N9','AG','GB','DC','DG','N6','N10','AD','N9','PD','PG','N8','AG'];
begin
  insert into public.seasons (club_id, label, starts_on, ends_on, is_active) values (c, 'Recette 2026-2027', current_date - 60, current_date + 240, true) returning id into s;
  insert into public.competitions (club_id, season_id, team_id, name, squad_size_limit, is_primary) values (c, s, t, 'Championnat D1 (recette)', 18, true) returning id into comp;
  update public.application_settings set active_season_id = s, active_competition_id = comp, default_team_id = t where club_id = c;
  for i in 1..22 loop
    insert into public.players (club_id, first_name, last_name) values (c, 'Joueuse' || i, names[i]) returning id into p;
    insert into public.player_seasons (club_id, player_id, season_id, team_id, shirt_number) values (c, p, s, t, i);
    insert into public.player_positions (club_id, player_id, position_id, is_primary) select c, p, id, true from public.positions where code = pos[i];
  end loop;
  insert into public.staff_members (club_id, role_id, first_name, last_name, status) select c, id, 'Awa', 'COACH', 'actif' from public.roles where code = 'head_coach';
  insert into public.staff_members (club_id, role_id, first_name, last_name, status) select c, id, 'Mariam', 'MANAGER', 'actif' from public.roles where code = 'team_manager';
  insert into public.user_roles (user_id, club_id, role_id)
  select u.id, c, r.id from auth.users u join public.roles r on r.code = case u.email
    when 'coach.test@yfc.test' then 'head_coach' when 'adjoint.test@yfc.test' then 'assistant_coach'
    when 'comm.test@yfc.test' then 'communication' when 'tm.test@yfc.test' then 'team_manager' end
  where u.email like '%.test@yfc.test';
end $$;
