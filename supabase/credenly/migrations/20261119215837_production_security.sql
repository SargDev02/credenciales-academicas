-- Versioned only. Apply separately after owner approval; never during a build.
create table public.production_rate_limits (
 bucket text not null check(length(bucket) between 1 and 80),
 subject_hash text not null check(subject_hash ~ '^[a-f0-9]{64}$'),
 hits integer not null check(hits > 0), resets_at timestamptz not null,
 primary key(bucket,subject_hash)
);
create index production_rate_limits_expiry on public.production_rate_limits(resets_at);
alter table public.production_rate_limits enable row level security;
revoke all on public.production_rate_limits from public,anon,authenticated,service_role;
grant select on public.production_rate_limits to service_role;
create function public.consume_production_limit(p_bucket text,p_subject_hash text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.production_rate_limits; n timestamptz:=clock_timestamp();
begin
 if p_bucket is null or length(p_bucket) not between 1 and 80 or p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' or p_limit is null or p_limit not between 1 and 1000 or p_window_seconds is null or p_window_seconds not between 1 and 3600 then raise exception 'INVALID_LIMIT_POLICY'; end if;
 -- Bounded housekeeping; no active window can be removed. The database clock
 -- and atomic upsert, not a Node process, arbitrate every replica.
 delete from public.production_rate_limits where (bucket,subject_hash) in
 (select bucket,subject_hash from public.production_rate_limits where resets_at<n-interval '1 hour' order by resets_at limit 20 for update skip locked);
 insert into public.production_rate_limits(bucket,subject_hash,hits,resets_at)
 values(p_bucket,p_subject_hash,1,n+make_interval(secs=>p_window_seconds))
 on conflict(bucket,subject_hash) do update set
 hits=case when production_rate_limits.resets_at<=n then 1 else least(production_rate_limits.hits+1,p_limit+1) end,
 resets_at=case when production_rate_limits.resets_at<=n then n+make_interval(secs=>p_window_seconds) else production_rate_limits.resets_at end
 returning * into r;
 return jsonb_build_object('allowed',r.hits<=p_limit,'retryAfter',case when r.hits<=p_limit then 0 else greatest(1,ceil(extract(epoch from r.resets_at-n))::int) end);
end $$;
revoke all on function public.consume_production_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_production_limit(text,text,integer,integer) to service_role;

-- Only explicitly selected temporary data. Never deletes Auth, citizens,
-- verifications, links, shares, audit or academic history. Defaults to dry-run.
create function public.maintain_credenly_privacy(p_before timestamptz,p_kind text,p_execute boolean default false,p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; ids uuid[];
begin
 if p_before is null or p_before>clock_timestamp()-interval '1 day' or p_limit is null or p_limit not between 1 and 1000 then raise exception 'INVALID_RETENTION_WINDOW'; end if;
 if p_kind='RESOLVED_OCR_TEXT' then
  select array_agg(id) into ids from (select id from public.verificaciones_identidad where estado in ('APROBADA','RECHAZADA') and processed_at<p_before and texto_extraido is not null order by processed_at limit p_limit for update skip locked) q;
  if p_execute then update public.verificaciones_identidad set texto_extraido=null where id=any(ids); end if;
 elsif p_kind='SHARE_ACCESSES' then
  select array_agg(id) into ids from (select id from public.accesos_compartidos where accessed_at<p_before order by accessed_at limit p_limit for update skip locked) q;
  if p_execute then delete from public.accesos_compartidos where id=any(ids); end if;
 else raise exception 'INVALID_RETENTION_KIND'; end if;
 n:=coalesce(cardinality(ids),0);
 return jsonb_build_object('selected',n,'executed',p_execute,'kind',p_kind);
end $$;
revoke all on function public.maintain_credenly_privacy(timestamptz,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.maintain_credenly_privacy(timestamptz,text,boolean,integer) to service_role;
