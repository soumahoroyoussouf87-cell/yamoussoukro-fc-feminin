-- =============================================================================
-- Migration 014 — Phase 3 (livraison 5) : coups de pied arrêtés (CPA)
-- Bibliothèque de combinaisons offensives et d'organisations défensives :
-- catégorie, côté, signal, consignes, schéma animé (même format que le tableau
-- tactique), tireuses dans l'ordre et responsabilités individuelles.
-- Confidentiel : réservé au staff technique (evaluations.read / evaluations.write).
-- Le schéma appartient à la combinaison (pas de copie dans la bibliothèque des
-- schémas d'entraînement) ; il est validé côté serveur au même format.
-- =============================================================================

create table public.set_piece_routines (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  category          text not null check (category in ('corner_off', 'corner_def', 'cf_off', 'cf_def', 'penalty', 'touche_off', 'touche_def')),
  name              text not null check (length(trim(name)) between 2 and 80),
  side              text not null default 'indifferent' check (side in ('gauche', 'droite', 'axe', 'indifferent')),
  signal            text check (length(signal) <= 60),
  instructions      text check (length(instructions) <= 3000),
  diagram           jsonb check (diagram is null or (jsonb_typeof(diagram) = 'object' and octet_length(diagram::text) <= 200000)),
  takers            uuid[] not null default '{}' check (cardinality(takers) <= 5),
  responsibilities  jsonb not null default '[]' check (jsonb_typeof(responsibilities) = 'array' and jsonb_array_length(responsibilities) <= 14),
  notes             text check (length(notes) <= 2000),
  sort_order        smallint not null default 0,
  archived_at       timestamptz,
  created_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index set_piece_routines_idx on public.set_piece_routines(club_id, category, sort_order) where archived_at is null;

-- Tireuses et joueuses désignées : uniquement des joueuses du club ; rôle obligatoire.
create or replace function app.guard_set_piece()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if exists (select 1 from unnest(new.takers) x
             where not exists (select 1 from public.players p where p.id = x and p.club_id = new.club_id)) then
    raise exception 'Tireuse d''un autre club.' using errcode = '23514';
  end if;
  if (select count(distinct x) from unnest(new.takers) x) <> cardinality(new.takers) then
    raise exception 'Une tireuse est inscrite deux fois.' using errcode = '23514';
  end if;
  for r in select * from jsonb_array_elements(new.responsibilities) loop
    if jsonb_typeof(r) <> 'object'
       or coalesce(length(trim(r->>'role')), 0) not between 2 and 120
       or (r ? 'player_id' and r->>'player_id' is not null and not exists (
             select 1 from public.players p where p.id::text = r->>'player_id' and p.club_id = new.club_id)) then
      raise exception 'Responsabilité invalide (joueuse du club et rôle de 2 à 120 caractères).' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

do $$
begin
  create trigger trg_set_piece_routines_updated before update on public.set_piece_routines
    for each row execute function app.set_updated_at();
  create trigger trg_set_piece_routines_audit after insert or update or delete on public.set_piece_routines
    for each row execute function app.audit_row();
  create trigger trg_set_piece_routines_guard before insert or update on public.set_piece_routines
    for each row execute function app.guard_set_piece();
  alter table public.set_piece_routines enable row level security;
  revoke all on public.set_piece_routines from anon;
end $$;

create policy set_piece_routines_select on public.set_piece_routines for select to authenticated
  using (app.has_permission(club_id, 'evaluations.read'));
create policy set_piece_routines_insert on public.set_piece_routines for insert to authenticated
  with check (app.has_permission(club_id, 'evaluations.write'));
create policy set_piece_routines_update on public.set_piece_routines for update to authenticated
  using (app.has_permission(club_id, 'evaluations.write')) with check (app.has_permission(club_id, 'evaluations.write'));
create policy set_piece_routines_delete on public.set_piece_routines for delete to authenticated
  using (app.has_permission(club_id, 'evaluations.write'));
