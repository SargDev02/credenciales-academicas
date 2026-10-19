-- A citizen may edit names, but only the backend may change verification state.
-- Existing ownership RLS policies and profile defaults remain unchanged.
begin;
revoke insert, update on public.perfiles from public, anon, authenticated;
grant insert (id, nombres, apellidos) on public.perfiles to authenticated;
grant update (nombres, apellidos) on public.perfiles to authenticated;
commit;
;
