-- Existing environments may grant EXECUTE directly to anon/authenticated via
-- default privileges. Revoking PUBLIC alone does not remove those role grants.
begin;

revoke all on function public.aprovisionar_integracion_institucional(
  uuid, varchar, varchar, varchar, varchar, text[]
) from public, anon, authenticated;
revoke all on function public.aprovisionar_cliente_api(
  varchar, varchar, varchar, varchar, varchar, text[]
) from public, anon, authenticated;

grant execute on function public.aprovisionar_integracion_institucional(
  uuid, varchar, varchar, varchar, varchar, text[]
) to service_role;
grant execute on function public.aprovisionar_cliente_api(
  varchar, varchar, varchar, varchar, varchar, text[]
) to service_role;

-- All application tables in these functions are already schema-qualified.
alter function public.aprovisionar_integracion_institucional(
  uuid, varchar, varchar, varchar, varchar, text[]
) set search_path = '';
alter function public.aprovisionar_cliente_api(
  varchar, varchar, varchar, varchar, varchar, text[]
) set search_path = '';

commit;
;
