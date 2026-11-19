create or replace function public.aprovisionar_integracion_institucional(
  p_institucion_id uuid,
  p_nombre varchar,
  p_client_id varchar,
  p_key_prefix varchar,
  p_secret_hash varchar,
  p_scope_codes text[]
)
returns table (
  id uuid,
  institucion_id uuid,
  nombre varchar,
  client_id varchar,
  estado varchar,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_integration_id uuid;
  v_scope_count integer;
begin
  if not exists (
    select 1
    from public.instituciones i
    where i.id = p_institucion_id
  ) then
    raise exception 'RAES_INSTITUTION_NOT_FOUND';
  end if;

  select count(*)
  into v_scope_count
  from public.scopes s
  where s.codigo = any(p_scope_codes);

  if v_scope_count <> coalesce(array_length(p_scope_codes, 1), 0) then
    raise exception 'RAES_INVALID_SCOPES';
  end if;

  insert into public.integraciones_institucionales (
    institucion_id,
    nombre,
    client_id,
    estado
  )
  values (
    p_institucion_id,
    p_nombre,
    p_client_id,
    'ACTIVA'
  )
  returning integraciones_institucionales.id
  into v_integration_id;

  insert into public.integracion_secretos (
    integracion_id,
    key_prefix,
    secret_hash,
    hash_algorithm
  )
  values (
    v_integration_id,
    p_key_prefix,
    p_secret_hash,
    'SHA256'
  );

  insert into public.integracion_scopes (
    integracion_id,
    scope_id
  )
  select
    v_integration_id,
    s.id
  from public.scopes s
  where s.codigo = any(p_scope_codes);

  return query
  select
    ii.id,
    ii.institucion_id,
    ii.nombre,
    ii.client_id,
    ii.estado,
    ii.created_at
  from public.integraciones_institucionales ii
  where ii.id = v_integration_id;
end;
$$;

create or replace function public.aprovisionar_cliente_api(
  p_nombre varchar,
  p_tipo_cliente varchar,
  p_client_id varchar,
  p_key_prefix varchar,
  p_secret_hash varchar,
  p_scope_codes text[]
)
returns table (
  id uuid,
  nombre varchar,
  tipo_cliente varchar,
  client_id varchar,
  estado varchar,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_scope_count integer;
begin
  if p_tipo_cliente not in (
    'CREDENLY',
    'VERIFICADOR',
    'GOBERNACION',
    'OTRO'
  ) then
    raise exception 'RAES_INVALID_API_CLIENT_TYPE';
  end if;

  select count(*)
  into v_scope_count
  from public.scopes s
  where s.codigo = any(p_scope_codes);

  if v_scope_count <> coalesce(array_length(p_scope_codes, 1), 0) then
    raise exception 'RAES_INVALID_SCOPES';
  end if;

  insert into public.clientes_api (
    nombre,
    tipo_cliente,
    client_id,
    estado
  )
  values (
    p_nombre,
    p_tipo_cliente,
    p_client_id,
    'ACTIVO'
  )
  returning clientes_api.id
  into v_client_id;

  insert into public.cliente_api_secretos (
    cliente_api_id,
    key_prefix,
    secret_hash,
    hash_algorithm
  )
  values (
    v_client_id,
    p_key_prefix,
    p_secret_hash,
    'SHA256'
  );

  insert into public.cliente_api_scopes (
    cliente_api_id,
    scope_id
  )
  select
    v_client_id,
    s.id
  from public.scopes s
  where s.codigo = any(p_scope_codes);

  return query
  select
    ca.id,
    ca.nombre,
    ca.tipo_cliente,
    ca.client_id,
    ca.estado,
    ca.created_at,
    ca.updated_at
  from public.clientes_api ca
  where ca.id = v_client_id;
end;
$$;

revoke all on function public.aprovisionar_integracion_institucional(
  uuid, varchar, varchar, varchar, varchar, text[]
) from public;

revoke all on function public.aprovisionar_cliente_api(
  varchar, varchar, varchar, varchar, varchar, text[]
) from public;

grant execute on function public.aprovisionar_integracion_institucional(
  uuid, varchar, varchar, varchar, varchar, text[]
) to service_role;

grant execute on function public.aprovisionar_cliente_api(
  varchar, varchar, varchar, varchar, varchar, text[]
) to service_role;
;
