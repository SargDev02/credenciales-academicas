-- Run AFTER proposed least-privilege correction. Read-only assertions.
begin;
do $$
declare t record; r text;
begin
  for t in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' loop
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r,t.oid,'TRUNCATE') or has_table_privilege(r,t.oid,'TRIGGER')
        or has_table_privilege(r,t.oid,'REFERENCES') then raise exception 'EXCESS_BROWSER_PRIVILEGE'; end if;
    end loop;
    if not has_table_privilege('service_role',t.oid,'SELECT') then raise exception 'BACKEND_READ_REVOKED'; end if;
  end loop;
end $$;
rollback;
select 'BROWSER_PRIVILEGES_OK' as result;
