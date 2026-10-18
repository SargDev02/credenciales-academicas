begin;
do $$
declare signature regprocedure := 'public.confirmar_vinculacion_raes(uuid,uuid,uuid)'::regprocedure;
begin
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'Link RPC publicly executable'; end if;
  if not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Server cannot confirm verified links'; end if;
end;
$$;
set local role anon;
do $$ begin
  begin
    perform public.confirmar_vinculacion_raes(null,null,null);
    raise exception 'anon entered link function';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.confirmar_vinculacion_raes(null,null,null);
    raise exception 'authenticated entered link function';
  exception when insufficient_privilege then null;
  end;
end; $$;
reset role;
set local role service_role;
do $$ begin
  begin
    perform public.confirmar_vinculacion_raes(null,null,null);
    raise exception 'Expected verification guard';
  exception when raise_exception then
    if sqlerrm <> 'CREDENLY_VERIFICATION_NOT_APPROVED' then raise; end if;
  end;
end; $$;
reset role;
rollback;
select 'LINK_RPC_PERMISSIONS_OK' as result;
