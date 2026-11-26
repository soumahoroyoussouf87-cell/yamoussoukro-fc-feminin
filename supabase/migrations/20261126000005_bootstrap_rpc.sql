-- Point d'entrée RPC de l'amorçage du premier administrateur.
-- Exécutable uniquement avec la clé service_role (scripts serveur), jamais par anon/authenticated.
create or replace function public.bootstrap_first_admin(p_email text, p_club uuid)
returns void
language sql security definer set search_path = ''
as $$ select app.bootstrap_first_admin(p_email, p_club) $$;
revoke all on function public.bootstrap_first_admin(text, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(text, uuid) to service_role;
