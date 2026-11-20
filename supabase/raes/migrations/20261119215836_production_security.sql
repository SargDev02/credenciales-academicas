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

create function public.manage_raes_secret(p_kind text,p_owner uuid,p_action text,p_secret uuid default null,p_prefix text default null,p_hash text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; tbl text; owner_col text;
begin
 if p_kind='INTEGRATION' then
  perform 1 from public.integraciones_institucionales where id=p_owner for update;
  tbl:='integracion_secretos';owner_col:='integracion_id';
 elsif p_kind='CLIENT' then
  perform 1 from public.clientes_api where id=p_owner for update;
  tbl:='cliente_api_secretos';owner_col:='cliente_api_id';
 else raise exception 'INVALID_SECRET_KIND'; end if;
 if not found then raise exception 'SECRET_OWNER_NOT_FOUND'; end if;
 if p_action='PREPARE' then
  if p_prefix is null or p_prefix !~ '^raes_sk_[A-Za-z0-9_-]{12}$' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SECRET_MATERIAL'; end if;
  execute format('insert into public.%I(%I,key_prefix,secret_hash,hash_algorithm) values($1,$2,$3,''SHA256'') returning id',tbl,owner_col) into result using p_owner,p_prefix,p_hash;
 elsif p_action='REVOKE' and p_secret is not null then
  execute format('update public.%I set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=$1 and %I=$2 returning id',tbl,owner_col) into result using p_secret,p_owner;
  if result is null then raise exception 'SECRET_NOT_FOUND'; end if;
 else raise exception 'INVALID_SECRET_ACTION'; end if;
 insert into public.auditoria(actor_tipo,accion,recurso_tipo,recurso_id,metadata)
 values('SISTEMA','SECRET_'||p_action,p_kind,result,jsonb_build_object('ownerId',p_owner));
 return result;
end $$;
revoke all on function public.manage_raes_secret(text,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_raes_secret(text,uuid,text,uuid,text,text) to service_role;
