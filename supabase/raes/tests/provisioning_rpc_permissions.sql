-- Verify permissions and service execution without creating clients/integrations.
begin;
do $$
declare
  signature regprocedure;
begin
  foreach signature in array array[
    'public.aprovisionar_cliente_api(varchar,varchar,varchar,varchar,varchar,text[])'::regprocedure,
    'public.aprovisionar_integracion_institucional(uuid,varchar,varchar,varchar,varchar,text[])'::regprocedure
  ] loop
    if has_function_privilege('anon', signature, 'EXECUTE')
       or has_function_privilege('authenticated', signature, 'EXECUTE') then
      raise exception 'Provisioning exposed to a public role';
    end if;
    if not has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'Server cannot provision';
    end if;
  end loop;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.aprovisionar_cliente_api(null, 'INVALID', null, null, null, array[]::text[]);
    raise exception 'anon entered provisioning';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aprovisionar_integracion_institucional(null, null, null, null, null, array[]::text[]);
    raise exception 'anon entered institutional provisioning';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  begin
    perform public.aprovisionar_cliente_api(null, 'INVALID', null, null, null, array[]::text[]);
    raise exception 'authenticated entered provisioning';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aprovisionar_integracion_institucional(null, null, null, null, null, array[]::text[]);
    raise exception 'authenticated entered institutional provisioning';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role service_role;
do $$
begin
  begin
    perform public.aprovisionar_cliente_api(null, 'INVALID', null, null, null, array[]::text[]);
    raise exception 'Expected invalid client type guard';
  exception when raise_exception then
    if sqlerrm <> 'RAES_INVALID_API_CLIENT_TYPE' then raise; end if;
  end;
  begin
    perform public.aprovisionar_integracion_institucional(null, null, null, null, null, array[]::text[]);
    raise exception 'Expected missing institution guard';
  exception when raise_exception then
    if sqlerrm <> 'RAES_INSTITUTION_NOT_FOUND' then raise; end if;
  end;
end;
$$;
reset role;
rollback;
select 'PROVISIONING_PERMISSIONS_OK' as result;
