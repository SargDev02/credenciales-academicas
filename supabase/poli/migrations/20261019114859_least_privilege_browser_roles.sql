-- PRE-DEPLOY PROPOSAL: not applied remotely. Review before any deployment.
begin;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
-- Table-level REVOKE does not remove independent column grants.
do $$
declare t record; cols text;
begin
  for t in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') loop
    select string_agg(format('%I',attname),',') into cols from pg_attribute
      where attrelid=t.oid and attnum>0 and not attisdropped;
    execute format('revoke all (%s) on table public.%I from public, anon, authenticated',cols,t.relname);
  end loop;
end $$;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
-- Explicit service_role grants already present are preserved. No data changes.
commit;
