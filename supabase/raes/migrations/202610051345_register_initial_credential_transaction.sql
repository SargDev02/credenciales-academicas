create or replace function public.registrar_credencial_inicial(
  p_integracion_id uuid,
  p_request_id varchar,
  p_idempotency_key varchar,
  p_request_hash varchar,
  p_persona_identificador_origen varchar,
  p_programa_codigo_origen varchar,
  p_sede_codigo_origen varchar,
  p_codigo_origen varchar,
  p_tipo varchar,
  p_categoria varchar,
  p_titulo varchar,
  p_descripcion text,
  p_fecha_emision date,
  p_fecha_grado date,
  p_numero_acta varchar,
  p_numero_folio varchar,
  p_numero_libro varchar,
  p_documento_hash_sha256 varchar,
  p_payload_original jsonb
)
returns table (
  operacion_id uuid,
  credencial_id uuid,
  codigo_raes varchar,
  numero_version integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_institucion_id uuid;
  v_persona_id uuid;
  v_programa_id uuid;
  v_sede_id uuid;
  v_operacion public.operaciones_api%rowtype;
  v_credencial public.credenciales%rowtype;
  v_version_id uuid;
begin
  if p_request_id is null or btrim(p_request_id) = '' then
    raise exception using errcode = 'P0001', message = 'RAES_REQUEST_ID_REQUIRED';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception using errcode = 'P0001', message = 'RAES_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_request_hash is null or length(p_request_hash) <> 64 then
    raise exception using errcode = 'P0001', message = 'RAES_REQUEST_HASH_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('idem:' || p_integracion_id::text || ':' || p_idempotency_key, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('req:' || p_integracion_id::text || ':' || p_request_id, 0)
  );

  select ii.institucion_id
    into v_institucion_id
  from public.integraciones_institucionales ii
  where ii.id = p_integracion_id
    and ii.estado = 'ACTIVA';

  if v_institucion_id is null then
    raise exception using errcode = 'P0001', message = 'RAES_INTEGRATION_NOT_ACTIVE';
  end if;

  select oa.*
    into v_operacion
  from public.operaciones_api oa
  where oa.integracion_id = p_integracion_id
    and oa.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_operacion.request_hash <> p_request_hash then
      raise exception using errcode = 'P0001', message = 'RAES_IDEMPOTENCY_CONFLICT';
    end if;

    if v_operacion.tipo_operacion <> 'CREDENTIAL_CREATE' then
      raise exception using errcode = 'P0001', message = 'RAES_IDEMPOTENCY_OPERATION_CONFLICT';
    end if;

    if v_operacion.estado = 'COMPLETADA' and v_operacion.credencial_id is not null then
      select c.*
        into v_credencial
      from public.credenciales c
      where c.id = v_operacion.credencial_id;

      if not found then
        raise exception using errcode = 'P0001', message = 'RAES_IDEMPOTENCY_RESULT_MISSING';
      end if;

      return query
      select
        v_operacion.id,
        v_credencial.id,
        v_credencial.codigo_raes,
        v_credencial.version_actual,
        true;
      return;
    end if;

    raise exception using errcode = 'P0001', message = 'RAES_IDEMPOTENCY_IN_PROGRESS';
  end if;

  if exists (
    select 1
    from public.operaciones_api oa
    where oa.integracion_id = p_integracion_id
      and oa.request_id = p_request_id
  ) then
    raise exception using errcode = 'P0001', message = 'RAES_REQUEST_ID_CONFLICT';
  end if;

  select pf.persona_id
    into v_persona_id
  from public.persona_fuentes pf
  where pf.institucion_id = v_institucion_id
    and pf.identificador_origen = p_persona_identificador_origen;

  if v_persona_id is null then
    raise exception using errcode = 'P0001', message = 'RAES_PERSON_SOURCE_NOT_FOUND';
  end if;

  if p_programa_codigo_origen is not null then
    select p.id
      into v_programa_id
    from public.programas p
    where p.institucion_id = v_institucion_id
      and p.codigo_origen = p_programa_codigo_origen;

    if v_programa_id is null then
      raise exception using errcode = 'P0001', message = 'RAES_PROGRAM_NOT_FOUND';
    end if;
  end if;

  if p_sede_codigo_origen is not null then
    select s.id
      into v_sede_id
    from public.sedes s
    where s.institucion_id = v_institucion_id
      and s.codigo_origen = p_sede_codigo_origen;

    if v_sede_id is null then
      raise exception using errcode = 'P0001', message = 'RAES_CAMPUS_NOT_FOUND';
    end if;
  end if;

  if exists (
    select 1
    from public.credenciales c
    where c.institucion_id = v_institucion_id
      and c.codigo_origen = p_codigo_origen
  ) then
    raise exception using errcode = 'P0001', message = 'RAES_CREDENTIAL_ALREADY_EXISTS';
  end if;

  insert into public.operaciones_api (
    integracion_id,
    request_id,
    idempotency_key,
    tipo_operacion,
    request_hash,
    estado,
    metadata
  )
  values (
    p_integracion_id,
    p_request_id,
    p_idempotency_key,
    'CREDENTIAL_CREATE',
    p_request_hash,
    'PROCESANDO',
    jsonb_build_object('codigo_origen', p_codigo_origen)
  )
  returning * into v_operacion;

  insert into public.credenciales (
    institucion_id,
    persona_id,
    programa_id,
    sede_id,
    codigo_origen,
    tipo,
    categoria,
    estado_actual,
    version_actual
  )
  values (
    v_institucion_id,
    v_persona_id,
    v_programa_id,
    v_sede_id,
    p_codigo_origen,
    p_tipo,
    p_categoria,
    'VIGENTE',
    1
  )
  returning * into v_credencial;

  insert into public.credencial_versiones (
    credencial_id,
    numero_version,
    programa_id,
    sede_id,
    titulo,
    descripcion,
    fecha_emision,
    fecha_grado,
    estado_reportado,
    numero_acta,
    numero_folio,
    numero_libro,
    documento_hash_sha256,
    payload_original,
    payload_hash_sha256,
    registrada_por_integracion_id
  )
  values (
    v_credencial.id,
    1,
    v_programa_id,
    v_sede_id,
    p_titulo,
    p_descripcion,
    p_fecha_emision,
    p_fecha_grado,
    'VIGENTE',
    p_numero_acta,
    p_numero_folio,
    p_numero_libro,
    p_documento_hash_sha256,
    p_payload_original,
    p_request_hash,
    p_integracion_id
  )
  returning id into v_version_id;

  insert into public.credencial_eventos (
    credencial_id,
    version_id,
    tipo_evento,
    motivo,
    metadata,
    integracion_id,
    ocurrido_at
  )
  values (
    v_credencial.id,
    v_version_id,
    'REGISTRADA',
    null,
    jsonb_build_object(
      'request_id', p_request_id,
      'idempotency_key', p_idempotency_key
    ),
    p_integracion_id,
    now()
  );

  update public.operaciones_api
  set
    estado = 'COMPLETADA',
    credencial_id = v_credencial.id,
    codigo_http = 201,
    completed_at = now()
  where id = v_operacion.id
  returning * into v_operacion;

  return query
  select
    v_operacion.id,
    v_credencial.id,
    v_credencial.codigo_raes,
    1,
    false;
end;
$$;

revoke all on function public.registrar_credencial_inicial(
  uuid, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar,
  varchar, varchar, text, date, date, varchar, varchar, varchar, varchar, jsonb
) from public, anon, authenticated;

grant execute on function public.registrar_credencial_inicial(
  uuid, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar,
  varchar, varchar, text, date, date, varchar, varchar, varchar, varchar, jsonb
) to service_role;
