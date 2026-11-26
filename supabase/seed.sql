-- Données d'amorçage du DÉVELOPPEMENT LOCAL uniquement.
-- Identité institutionnelle du club (aucune joueuse, aucun résultat, aucune statistique).
insert into public.clubs (id, name, short_name, tagline, city)
values ('6f1d6a3e-0000-4000-8000-000000000001', 'Yamoussoukro FC Féminin', 'YFC Féminin',
        'OBSERVER • ÉVALUER • PLANIFIER • DÉVELOPPER • PERFORMER', 'Yamoussoukro')
on conflict (id) do nothing;

insert into public.teams (id, club_id, name, category, is_default)
values ('6f1d6a3e-0000-4000-8000-000000000002', '6f1d6a3e-0000-4000-8000-000000000001', 'Équipe Seniors', 'senior', true)
on conflict (id) do nothing;

insert into public.application_settings (club_id, default_team_id)
values ('6f1d6a3e-0000-4000-8000-000000000001', '6f1d6a3e-0000-4000-8000-000000000002')
on conflict (club_id) do nothing;
