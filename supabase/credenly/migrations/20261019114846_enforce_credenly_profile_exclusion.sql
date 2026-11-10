-- PRE-DEPLOY PROPOSAL: not applied remotely. Review before any deployment.
-- No email-based authorization and no changes to existing citizen UUIDs.
begin;
do $$ begin
  if exists(select 1 from public.perfiles c join public.perfiles_admin a using(id)) then
    raise exception 'CREDENLY_PROFILE_OVERLAP_REQUIRES_OWNER_REVIEW';
  end if;
end $$;
create or replace function public.enforce_credenly_profile_exclusion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- The lock serializes both profile writers; each subsequent statement must
  -- see a fresh committed snapshot. Reject unsupported isolation rather than
  -- silently allowing a stale cross-table check.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode='0A000', message='CREDENLY_PROFILE_ISOLATION_UNSUPPORTED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 734621));
  if (tg_table_name='perfiles' and exists(select 1 from public.perfiles_admin where id=new.id))
    or (tg_table_name='perfiles_admin' and exists(select 1 from public.perfiles where id=new.id)) then
    raise exception using errcode='23514', message='CREDENLY_PROFILE_KIND_CONFLICT';
  end if;
  return new;
end $$;
revoke all on function public.enforce_credenly_profile_exclusion() from public, anon, authenticated, service_role;
create trigger trg_perfiles_exclusive_kind before insert or update of id on public.perfiles
  for each row execute function public.enforce_credenly_profile_exclusion();
create trigger trg_perfiles_admin_exclusive_kind before insert or update of id on public.perfiles_admin
  for each row execute function public.enforce_credenly_profile_exclusion();
commit;
