begin;
do $$
declare role_name text; table_name text; operation text;
begin
  foreach table_name in array array['perfiles_admin','auditoria_admin'] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',table_name)::regclass) then raise exception 'RLS missing: %',table_name; end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=table_name) then raise exception 'Unexpected browser policy: %',table_name; end if;
    foreach role_name in array array['anon','authenticated'] loop
      foreach operation in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(role_name,format('public.%I',table_name),operation) then raise exception 'Unexpected grant: % % %',role_name,table_name,operation; end if;
      end loop;
      if has_any_column_privilege(role_name,format('public.%I',table_name),'INSERT,UPDATE,SELECT') then raise exception 'Unexpected column grant: % %',role_name,table_name; end if;
    end loop;
    if not has_table_privilege('service_role',format('public.%I',table_name),'SELECT,INSERT') then raise exception 'Missing backend grant: %',table_name; end if;
    if has_table_privilege('service_role',format('public.%I',table_name),'DELETE') then raise exception 'Runtime delete not needed: %',table_name; end if;
  end loop;
  if not has_table_privilege('service_role','public.perfiles_admin','UPDATE') then raise exception 'Missing backend profile update grant'; end if;
  if has_table_privilege('service_role','public.auditoria_admin','UPDATE') then raise exception 'Audit must be append-only to runtime'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.perfiles_admin'::regclass and confrelid='auth.users'::regclass and contype='f') then raise exception 'Auth UUID FK missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin perform 1 from public.perfiles_admin; raise exception 'Citizen can read administrators'; exception when insufficient_privilege then null; end;
  begin insert into public.perfiles_admin(id,nombres,apellidos,rol,estado) values('00000000-0000-4000-8000-000000000001','Synthetic','Denied','ADMIN_CREDENLY','ACTIVO'); raise exception 'Citizen can self-elevate'; exception when insufficient_privilege then null; end;
  begin update public.perfiles_admin set rol='ADMIN_CREDENLY',estado='ACTIVO'; raise exception 'Citizen can change roles'; exception when insufficient_privilege then null; end;
  begin delete from public.perfiles_admin; raise exception 'Citizen can delete administrators'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.auditoria_admin; raise exception 'Citizen can read audit'; exception when insufficient_privilege then null; end;
  begin insert into public.auditoria_admin(actor_id,accion,resultado,recurso_tipo) values('00000000-0000-4000-8000-000000000001','HEALTH_READ','EXITO','HEALTH'); raise exception 'Citizen can forge audit'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.perfiles_admin; raise exception 'Anon can read administrators'; exception when insufficient_privilege then null; end;
  begin insert into public.perfiles_admin(id,nombres,apellidos) values('00000000-0000-4000-8000-000000000001','Synthetic','Denied'); raise exception 'Anon can create administrator'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.auditoria_admin; raise exception 'Anon can read audit'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'ADMIN_RLS_GRANTS_AND_CITIZEN_DENIAL_OK' as result;
