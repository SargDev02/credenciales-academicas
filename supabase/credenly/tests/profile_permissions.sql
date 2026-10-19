begin;
do $$
begin
  if has_column_privilege('authenticated','public.perfiles','estado','INSERT') or has_column_privilege('authenticated','public.perfiles','estado','UPDATE') then raise exception 'Citizen can set verification state'; end if;
  if not has_column_privilege('authenticated','public.perfiles','nombres','UPDATE') then raise exception 'Citizen name editing disabled'; end if;
  if not has_column_privilege('service_role','public.perfiles','estado','UPDATE') then raise exception 'Backend cannot confirm profile state'; end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  if exists(select 1 from public.verificaciones_identidad) or exists(select 1 from public.vinculaciones_raes) or exists(select 1 from public.comparticiones) then raise exception 'Foreign citizen records visible'; end if;
  begin
    update public.perfiles set estado='ACTIVO';
    raise exception 'Citizen can change state';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
rollback;
select 'PROFILE_COLUMN_PERMISSIONS_AND_OWNERSHIP_RLS_OK' as result;
