-- Avoid changing timestamps on reused, unchanged catalogs during approval.
begin;
create or replace function public.academic_review_apply_credential(p_request public.solicitudes_revision_academica, p_credential jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 v_input jsonb:=p_credential->'contenido'; v_program jsonb:=p_credential->'programa'; v_campus jsonb:=p_credential->'sede'; v_relation jsonb:=p_credential->'relacion';
 v_old jsonb; v_current public.credenciales%rowtype; v_person uuid; v_program_id uuid; v_campus_id uuid; v_key text; v_hash text; v_reason text; v_result record;
begin
 select persona_id into v_person from public.persona_fuentes where institucion_id=p_request.institucion_id and identificador_origen=v_input->>'personaIdentificadorOrigen';
 if v_person is null then raise exception 'REVIEW_PERSON_REQUIRED'; end if;
 select * into v_current from public.credenciales where institucion_id=p_request.institucion_id and codigo_origen=v_input->>'codigoOrigen' for update;
 v_old:=public.academic_review_current(p_request.institucion_id,'CREDENCIAL',v_input->>'codigoOrigen',v_input->>'personaIdentificadorOrigen');
 if v_current.id is not null then
  if v_current.persona_id<>v_person then raise exception 'REVIEW_IDENTITY_CHANGE_BLOCKED'; end if;
  if v_current.estado_actual<>'VIGENTE' then
   if (v_old->'contenido') is distinct from v_input or v_old->>'estado' is distinct from p_credential->>'estado' or v_old->'programa' is distinct from v_program or v_old->'sede' is distinct from v_campus or v_old->'relacion' is distinct from v_relation then raise exception 'REVIEW_TERMINAL_BLOCKED'; end if;
   return v_current.id;
  end if;
 end if;
 insert into public.programas(institucion_id,codigo_origen,codigo_snies,nombre,nivel_formacion,modalidad,facultad,estado)
 values(p_request.institucion_id,v_program->>'codigoOrigen',v_program->>'codigoSnies',v_program->>'nombre',v_program->>'nivelFormacion',v_program->>'modalidad',v_program->>'facultad',v_program->>'estado')
 on conflict (institucion_id,codigo_origen) do update set codigo_snies=excluded.codigo_snies,nombre=excluded.nombre,nivel_formacion=excluded.nivel_formacion,modalidad=excluded.modalidad,facultad=excluded.facultad,estado=excluded.estado
 where (programas.codigo_snies,programas.nombre,programas.nivel_formacion,programas.modalidad,programas.facultad,programas.estado) is distinct from (excluded.codigo_snies,excluded.nombre,excluded.nivel_formacion,excluded.modalidad,excluded.facultad,excluded.estado) returning id into v_program_id;
 if v_program_id is null then select id into strict v_program_id from public.programas where institucion_id=p_request.institucion_id and codigo_origen=v_program->>'codigoOrigen'; end if;
 insert into public.sedes(institucion_id,codigo_origen,nombre,departamento,municipio,direccion,estado)
 values(p_request.institucion_id,v_campus->>'codigoOrigen',v_campus->>'nombre',v_campus->>'departamento',v_campus->>'municipio',v_campus->>'direccion',v_campus->>'estado')
 on conflict (institucion_id,codigo_origen) do update set nombre=excluded.nombre,departamento=excluded.departamento,municipio=excluded.municipio,direccion=excluded.direccion,estado=excluded.estado
 where (sedes.nombre,sedes.departamento,sedes.municipio,sedes.direccion,sedes.estado) is distinct from (excluded.nombre,excluded.departamento,excluded.municipio,excluded.direccion,excluded.estado) returning id into v_campus_id;
 if v_campus_id is null then select id into strict v_campus_id from public.sedes where institucion_id=p_request.institucion_id and codigo_origen=v_campus->>'codigoOrigen'; end if;
 insert into public.programa_sede(programa_id,sede_id,jornada,modalidad,estado) values(v_program_id,v_campus_id,v_relation->>'jornada',v_relation->>'modalidad',v_relation->>'estado')
 on conflict (programa_id,sede_id) do update set jornada=excluded.jornada,modalidad=excluded.modalidad,estado=excluded.estado
 where (programa_sede.jornada,programa_sede.modalidad,programa_sede.estado) is distinct from (excluded.jornada,excluded.modalidad,excluded.estado);
 v_hash:=encode(sha256(convert_to(public.academic_review_canonical(p_credential),'UTF8')),'hex');
 v_key:='review:'||p_request.id::text||':'||encode(sha256(convert_to(p_credential->>'identificadorOrigen','UTF8')),'hex');
 v_reason:=p_request.motivo_decision;
 if v_current.id is null then
  select * into v_result from public.registrar_credencial_inicial(p_request.integracion_id, (v_key||':new')::varchar,(v_key||':new')::varchar,v_hash::varchar,
   (v_input->>'personaIdentificadorOrigen')::varchar,(v_input->>'programaCodigoOrigen')::varchar,(v_input->>'sedeCodigoOrigen')::varchar,(v_input->>'codigoOrigen')::varchar,
   (v_input->>'tipo')::varchar,(v_input->>'categoria')::varchar,(v_input->>'titulo')::varchar,v_input->>'descripcion',(v_input->>'fechaEmision')::date,(v_input->>'fechaGrado')::date,(v_input->>'numeroActa')::varchar,(v_input->>'numeroFolio')::varchar,(v_input->>'numeroLibro')::varchar,(v_input->>'documentoHashSha256')::varchar,p_credential||jsonb_build_object('revisionId',p_request.id));
  select * into strict v_current from public.credenciales where id=v_result.credencial_id;
 elsif (v_old->'contenido') is distinct from v_input or v_old->'programa' is distinct from v_program or v_old->'sede' is distinct from v_campus or v_old->'relacion' is distinct from v_relation then
  perform public.corregir_credencial(p_request.integracion_id,(v_key||':edit')::varchar,(v_key||':edit')::varchar,v_hash::varchar,(v_input->>'codigoOrigen')::varchar,v_reason,now(),
   (v_input->>'programaCodigoOrigen')::varchar,(v_input->>'sedeCodigoOrigen')::varchar,(v_input->>'tipo')::varchar,(v_input->>'categoria')::varchar,(v_input->>'titulo')::varchar,v_input->>'descripcion',(v_input->>'fechaEmision')::date,(v_input->>'fechaGrado')::date,(v_input->>'numeroActa')::varchar,(v_input->>'numeroFolio')::varchar,(v_input->>'numeroLibro')::varchar,(v_input->>'documentoHashSha256')::varchar,p_credential||jsonb_build_object('revisionId',p_request.id));
 end if;
 if p_credential->>'estado'<>'VIGENTE' then
  perform public.transicionar_estado_credencial(p_request.integracion_id,(v_key||':state')::varchar,(v_key||':state')::varchar,v_hash::varchar,
   (case when p_credential->>'estado'='REVOCADA' then 'CREDENTIAL_REVOKE' else 'CREDENTIAL_ANNUL' end)::varchar,(v_input->>'codigoOrigen')::varchar,v_reason,now(),jsonb_build_object('revisionId',p_request.id,'estado',p_credential->>'estado'));
 end if;
 return v_current.id;
end $$;

commit;
