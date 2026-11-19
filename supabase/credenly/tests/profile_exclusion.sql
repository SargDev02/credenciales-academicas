-- Negative attempts are rejected BEFORE INSERT. Everything is rolled back.
-- No Auth changes, no emails, no account conversion, no academic writes.
begin;
do $$ begin
 if exists(select 1 from public.perfiles c join public.perfiles_admin a using(id)) then raise exception 'EXISTING_PROFILE_OVERLAP'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from public.perfiles_admin limit 1),true);
set local role authenticated;
do $$ begin
 if nullif(current_setting('request.jwt.claim.sub'), '') is null then raise exception 'ADMIN_FIXTURE_REQUIRED'; end if;
 begin
  insert into public.perfiles(id,nombres,apellidos) values(current_setting('request.jwt.claim.sub')::uuid,'SYNTHETIC','DENIED');
  raise exception 'ADMIN_CITIZEN_OVERLAP_ALLOWED';
 exception when check_violation then
  if sqlerrm <> 'CREDENLY_PROFILE_KIND_CONFLICT' then raise; end if;
 end;
end $$;
reset role;
do $$ declare citizen uuid; begin
 select id into strict citizen from public.perfiles limit 1;
 begin
  insert into public.perfiles_admin(id,nombres,apellidos) values(citizen,'SYNTHETIC','DENIED');
  raise exception 'CITIZEN_ADMIN_OVERLAP_ALLOWED';
 exception when check_violation then
  if sqlerrm <> 'CREDENLY_PROFILE_KIND_CONFLICT' then raise; end if;
 end;
end $$;
rollback;
select 'PROFILE_KINDS_EXCLUSIVE_OK' as result;
