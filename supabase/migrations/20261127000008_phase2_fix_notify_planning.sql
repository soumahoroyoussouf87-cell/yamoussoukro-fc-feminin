-- =============================================================================
-- Migration 008 — Correctif : app.notify_planning() référençait new.session_date
-- dans une condition évaluée aussi pour les microcycles (champ inexistant),
-- ce qui faisait échouer toute création de microcycle. Les conditions propres
-- aux séances sont désormais imbriquées.
-- =============================================================================
create or replace function app.notify_planning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publie' and (tg_op = 'INSERT' or old.status is distinct from 'publie') then
    if tg_table_name = 'microcycles' then
      perform app.notify_staff(new.club_id, 'programme', 'Programme hebdomadaire publié',
        'Semaine du ' || to_char(new.week_start, 'DD/MM/YYYY'), '/planification/programme?semaine=' || new.week_start);
    elsif tg_table_name = 'training_sessions' then
      perform app.notify_staff(new.club_id, 'seance', 'Nouvelle séance publiée',
        'Séance n°' || new.number || ' du ' || to_char(new.session_date, 'DD/MM/YYYY'), '/entrainement/seances/' || new.id);
    end if;
  elsif tg_op = 'UPDATE' and tg_table_name = 'training_sessions' then
    if old.status = 'publie'
       and (new.session_date, new.starts_at, new.ends_at) is distinct from (old.session_date, old.starts_at, old.ends_at) then
      perform app.notify_staff(new.club_id, 'horaire', 'Modification d''horaire',
        'Séance n°' || new.number || ' : ' || to_char(new.session_date, 'DD/MM/YYYY') || coalesce(' à ' || to_char(new.starts_at, 'HH24:MI'), ''),
        '/entrainement/seances/' || new.id);
    end if;
  end if;
  return new;
end;
$$;
