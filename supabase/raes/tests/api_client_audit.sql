-- Non-destructive database regression checks. Every test row is rolled back.
begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.auditoria'::regclass) then
    raise exception 'Audit RLS must remain enabled';
  end if;
end;
$$;

insert into public.auditoria (actor_tipo, accion, recurso_tipo)
values ('ADMIN', 'AUDIT_REGRESSION', 'TEST'),
       ('INTEGRACION', 'AUDIT_REGRESSION', 'TEST'),
       ('SISTEMA', 'AUDIT_REGRESSION', 'TEST'),
       ('CLIENTE_API', 'AUDIT_REGRESSION', 'TEST');

do $$
begin
  begin
    insert into public.auditoria (actor_tipo, accion, recurso_tipo)
    values ('INVALID_ACTOR', 'AUDIT_REGRESSION', 'TEST');
    raise exception 'Unknown actor unexpectedly accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    if exists (select 1 from public.auditoria) then
      raise exception 'anon can read audit records';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.auditoria (actor_tipo, accion, recurso_tipo)
    values ('CLIENTE_API', 'FORGED_AUDIT', 'TEST');
    raise exception 'anon can forge audit records';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  begin
    if exists (select 1 from public.auditoria) then
      raise exception 'authenticated can read audit records';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.auditoria (actor_tipo, accion, recurso_tipo)
    values ('CLIENTE_API', 'FORGED_AUDIT', 'TEST');
    raise exception 'authenticated can forge audit records';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
select 'AUDIT_ACTORS_AND_RLS_OK' as result;
