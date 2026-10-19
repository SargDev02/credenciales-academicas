-- Real RPC regression on an existing UdeA credential, using subtransaction
-- rollback for each scenario. No institutional data or persistent test rows.
begin;
do $$
declare
  c public.credenciales%rowtype;
  v public.credencial_versiones%rowtype;
  integration uuid;
  program_code varchar;
  campus_code varchar;
  original_version jsonb;
  version_count integer;
  event_count integer;
  scenario text;
  result record;
begin
  select cr.* into strict c from public.credenciales cr
    join public.instituciones i on i.id=cr.institucion_id
    where i.nit='890980040-8' and cr.estado_actual='VIGENTE'
    order by cr.id limit 1;
  select * into strict v from public.credencial_versiones
    where credencial_id=c.id and numero_version=c.version_actual;
  original_version := to_jsonb(v);
  select id into strict integration from public.integraciones_institucionales
    where institucion_id=c.institucion_id and estado='ACTIVA' limit 1;
  select codigo_origen into program_code from public.programas where id=c.programa_id;
  select codigo_origen into campus_code from public.sedes where id=c.sede_id;
  select count(*) into version_count from public.credencial_versiones where credencial_id=c.id;
  select count(*) into event_count from public.credencial_eventos where credencial_id=c.id;
  foreach scenario in array array['CREDENTIAL_REVOKE','CREDENTIAL_ANNUL'] loop
    begin
      select * into strict result from public.corregir_credencial(
        p_integracion_id=>integration,
        p_request_id=>gen_random_uuid()::text,
        p_idempotency_key=>'regression-correct-'||gen_random_uuid()::text,
        p_request_hash=>repeat('a',64),
        p_codigo_origen=>c.codigo_origen,
        p_motivo=>'Validación transaccional sin persistencia',
        p_ocurrido_at=>now(),
        p_programa_codigo_origen=>program_code,
        p_sede_codigo_origen=>campus_code,
        p_tipo=>v.tipo,p_categoria=>v.categoria,p_titulo=>v.titulo,
        p_descripcion=>v.descripcion,p_fecha_emision=>v.fecha_emision,
        p_fecha_grado=>v.fecha_grado,p_numero_acta=>v.numero_acta,
        p_numero_folio=>v.numero_folio,p_numero_libro=>v.numero_libro,
        p_documento_hash_sha256=>v.documento_hash_sha256,
        p_payload_original=>jsonb_build_object('test','transactional-regression')
      );
      if result.numero_version <> c.version_actual+1 then raise exception 'Correction version mismatch'; end if;
      if (select to_jsonb(cv) from public.credencial_versiones cv where cv.id=v.id) <> original_version then
        raise exception 'Previous version was modified';
      end if;
      select * into strict result from public.transicionar_estado_credencial(
        p_integracion_id=>integration,p_request_id=>gen_random_uuid()::text,
        p_idempotency_key=>'regression-terminal-'||gen_random_uuid()::text,
        p_request_hash=>repeat('b',64),p_operacion=>scenario,
        p_codigo_origen=>c.codigo_origen,p_motivo=>'Validación transaccional sin persistencia',
        p_ocurrido_at=>now(),p_payload_original=>jsonb_build_object('test','transactional-regression')
      );
      if result.numero_version <> c.version_actual+2 then raise exception 'Terminal version mismatch'; end if;
      if result.estado_actual <> (case when scenario='CREDENTIAL_REVOKE' then 'REVOCADA' else 'ANULADA' end) then
        raise exception 'Terminal state mismatch';
      end if;
      if (select count(*) from public.credencial_versiones where credencial_id=c.id) <> version_count+2 then raise exception 'Versions missing'; end if;
      if (select count(*) from public.credencial_eventos where credencial_id=c.id) <> event_count+2 then raise exception 'Events missing'; end if;
      raise exception 'ROLLBACK_REGRESSION_SCENARIO';
    exception when raise_exception then
      if sqlerrm <> 'ROLLBACK_REGRESSION_SCENARIO' then raise; end if;
    end;
    if (select version_actual from public.credenciales where id=c.id) <> c.version_actual then raise exception 'Rollback did not preserve credential'; end if;
    if (select count(*) from public.credencial_versiones where credencial_id=c.id) <> version_count then raise exception 'Rollback did not preserve history'; end if;
  end loop;
end;
$$;
rollback;
select 'EXISTING_CREDENTIAL_CORRECTION_REVOCATION_ANNULMENT_OK' as result;
