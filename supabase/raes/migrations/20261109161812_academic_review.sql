-- Supervised academic changes. Does not rewrite existing academic rows/history.
begin;

create table public.cortes_revision_academica (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null unique references public.instituciones(id),
  integracion_id uuid not null references public.integraciones_institucionales(id),
  cantidades jsonb not null,
  created_at timestamptz not null default now()
);
create table public.huellas_baseline_revision_academica (
 corte_id uuid not null references public.cortes_revision_academica(id),
 entidad_tipo text not null,
 identificador_origen text not null,
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 source_updated_at timestamptz,
 recurso_raes_id uuid,
 created_at timestamptz not null default now(),
 primary key(corte_id,entidad_tipo,identificador_origen)
);
alter table public.huellas_baseline_revision_academica enable row level security;
revoke all on public.huellas_baseline_revision_academica from public,anon,authenticated,service_role;
grant select on public.huellas_baseline_revision_academica to service_role;
create trigger trg_baseline_immutable before update or delete on public.huellas_baseline_revision_academica for each row execute function public.prevent_update_or_delete();
create table public.origenes_revision_academica (
  institucion_id uuid not null references public.instituciones(id),
  entidad_tipo text not null check (entidad_tipo in ('ESTUDIANTE','CREDENCIAL','PROGRAMA','SEDE','PROGRAMA_SEDE')),
  identificador_origen text not null check (length(identificador_origen) between 1 and 150),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  source_updated_at timestamptz,
  corte_id uuid references public.cortes_revision_academica(id),
  recurso_raes_id uuid,
  secuencia bigint not null default 0,
  solicitud_actual_id uuid,
  created_at timestamptz not null default now(),
  primary key (institucion_id, entidad_tipo, identificador_origen)
);
create table public.solicitudes_revision_academica (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones(id),
  integracion_id uuid not null references public.integraciones_institucionales(id),
  tipo text not null check (tipo in ('NUEVO_ESTUDIANTE','ACTUALIZACION_ESTUDIANTE','NUEVA_CREDENCIAL','ACTUALIZACION_CREDENCIAL')),
  entidad_tipo text not null check (entidad_tipo in ('ESTUDIANTE','CREDENCIAL')),
  identificador_origen text not null check (length(identificador_origen) between 1 and 150),
  persona_identificador_origen text not null,
  credencial_codigo_origen text,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_canonico text not null,
  secuencia bigint not null,
  source_updated_at timestamptz,
  payload_propuesto jsonb not null check (jsonb_typeof(payload_propuesto) = 'object' and octet_length(payload_propuesto::text) <= 65536),
  cambios_detectados jsonb not null default '{}',
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','APROBADA','RECHAZADA','SUPERSEDIDA')),
  detectada_at timestamptz not null default now(),
  revisada_at timestamptz,
  revisada_por uuid, -- immutable actor UUID, retained even if its Auth account is removed
  motivo_decision text check (length(motivo_decision) between 3 and 1000),
  recurso_raes_id uuid,
  superseded_by_id uuid references public.solicitudes_revision_academica(id) deferrable initially deferred,
  supersedes_id uuid references public.solicitudes_revision_academica(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institucion_id, entidad_tipo, identificador_origen, secuencia),
  check ((estado in ('APROBADA','RECHAZADA') and revisada_por is not null and revisada_at is not null and motivo_decision is not null)
    or (estado in ('PENDIENTE','SUPERSEDIDA') and revisada_por is null and revisada_at is null and motivo_decision is null))
);
alter table public.origenes_revision_academica add foreign key (solicitud_actual_id) references public.solicitudes_revision_academica(id);
create unique index academic_review_one_pending on public.solicitudes_revision_academica(institucion_id,entidad_tipo,identificador_origen) where estado = 'PENDIENTE';
create index academic_review_inbox on public.solicitudes_revision_academica(estado,detectada_at desc,id desc);
create index academic_review_institution on public.solicitudes_revision_academica(institucion_id,detectada_at desc,id desc);
create index academic_review_source_code on public.solicitudes_revision_academica(credencial_codigo_origen);
create trigger trg_academic_review_updated before update on public.solicitudes_revision_academica for each row execute function public.set_updated_at();
alter table public.cortes_revision_academica enable row level security;
alter table public.origenes_revision_academica enable row level security;
alter table public.solicitudes_revision_academica enable row level security;
revoke all on public.cortes_revision_academica, public.origenes_revision_academica, public.solicitudes_revision_academica from public, anon, authenticated;
grant select on public.cortes_revision_academica, public.origenes_revision_academica, public.solicitudes_revision_academica to service_role;
-- All writes go through the narrowly granted RPCs, even for the API role.
revoke insert,update,delete,truncate,references,trigger on public.cortes_revision_academica, public.origenes_revision_academica, public.solicitudes_revision_academica from service_role;

create table public.detecciones_revision_academica (
 institucion_id uuid primary key references public.instituciones(id),
 id uuid not null unique default gen_random_uuid(),
 vence_at timestamptz not null,
 estado text not null check (estado in ('EN_CURSO','COMPLETADA','ERROR')),
 updated_at timestamptz not null default now()
);
alter table public.detecciones_revision_academica enable row level security;
revoke all on public.detecciones_revision_academica from public, anon, authenticated, service_role;
grant select on public.detecciones_revision_academica to service_role;

create function public.academic_review_canonical(p_value jsonb) returns text
language plpgsql immutable strict set search_path = '' as $$
declare v_result text;
begin
  case jsonb_typeof(p_value)
  when 'object' then
    select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.academic_review_canonical(value), ',' order by key collate "C"), '') || '}' into v_result from jsonb_each(p_value);
  when 'array' then
    select '[' || coalesce(string_agg(public.academic_review_canonical(value), ',' order by ord), '') || ']' into v_result from jsonb_array_elements(p_value) with ordinality as a(value,ord);
  else v_result := p_value::text;
  end case;
  return v_result;
end $$;
create function public.academic_review_content(p_value jsonb) returns jsonb
language plpgsql immutable strict set search_path = '' as $$
declare v_result jsonb;
begin
 case jsonb_typeof(p_value)
 when 'object' then select coalesce(jsonb_object_agg(key,public.academic_review_content(value)),'{}') into v_result from jsonb_each(p_value) where key<>'sourceUpdatedAt';
 when 'array' then select coalesce(jsonb_agg(public.academic_review_content(value) order by ord),'[]') into v_result from jsonb_array_elements(p_value) with ordinality as a(value,ord);
 else v_result:=p_value;
 end case;
 return v_result;
end $$;
create function public.academic_review_fingerprint(p_inst uuid, p_entity text, p_key text, p_content jsonb) returns text
language sql immutable strict set search_path = '' as $$
  select encode(sha256(convert_to(public.academic_review_canonical(jsonb_build_object('institucion',p_inst,'entidad',p_entity,'origen',p_key,'contenido',public.academic_review_content(p_content))), 'UTF8')), 'hex');
$$;
create function public.academic_review_changes(p_actual jsonb, p_proposed jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v_key text; v_result jsonb:='{}'; v_nested jsonb; v_entry record;
begin
 for v_key in select jsonb_object_keys(coalesce(p_actual,'{}')) union select jsonb_object_keys(coalesce(p_proposed,'{}')) loop
  if v_key='sourceUpdatedAt' then continue; end if;
  if jsonb_typeof(p_actual->v_key)='object' and jsonb_typeof(p_proposed->v_key)='object' then
   v_nested:=public.academic_review_changes(p_actual->v_key,p_proposed->v_key);
   for v_entry in select key,value from jsonb_each(v_nested) loop v_result:=v_result||jsonb_build_object(v_key||'.'||v_entry.key,v_entry.value); end loop;
  elsif p_actual->v_key is distinct from p_proposed->v_key then
   v_result:=v_result||jsonb_build_object(v_key,jsonb_build_object('actual',p_actual->v_key,'propuesto',p_proposed->v_key));
  end if;
 end loop;
 return v_result;
end $$;

-- One advisory transaction lock per institution is shared by baseline, submit and decision.
-- READ COMMITTED is required: a snapshot from before the lock must never approve stale work.
create function public.academic_review_lock(p_inst uuid) returns void
language plpgsql set search_path = '' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'REVIEW_ISOLATION_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('academic-review:'||p_inst::text,0));
end $$;

create function public.controlar_deteccion_academica(p_integracion_id uuid, p_accion text, p_deteccion_id uuid default null, p_error boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_row public.detecciones_revision_academica%rowtype;
begin
 select ii.institucion_id into v_inst from public.integraciones_institucionales ii join public.instituciones i on i.id=ii.institucion_id where ii.id=p_integracion_id and ii.estado='ACTIVA' and i.estado='ACTIVA';
 if v_inst is null then raise exception 'REVIEW_INVALID_INTEGRATION'; end if;
 if not exists(select 1 from public.integracion_scopes x join public.scopes s on s.id=x.scope_id where x.integracion_id=p_integracion_id and s.codigo='academic-review:submit') then raise exception 'REVIEW_FORBIDDEN'; end if;
 perform public.academic_review_lock(v_inst);
 if not exists(select 1 from public.cortes_revision_academica where institucion_id=v_inst) then raise exception 'REVIEW_BASELINE_REQUIRED'; end if;
 select * into v_row from public.detecciones_revision_academica where institucion_id=v_inst for update;
 if p_accion='INICIAR' then
  if v_row.vence_at>clock_timestamp() then raise exception 'REVIEW_DETECTION_RUNNING'; end if;
  insert into public.detecciones_revision_academica(institucion_id,vence_at,estado) values(v_inst,clock_timestamp()+interval '120 seconds','EN_CURSO')
   on conflict (institucion_id) do update set id=gen_random_uuid(),vence_at=excluded.vence_at,estado='EN_CURSO',updated_at=now() returning * into v_row;
 elsif p_accion='FINALIZAR' then
  if v_row.id is distinct from p_deteccion_id then raise exception 'REVIEW_DETECTION_EXPIRED'; end if;
  update public.detecciones_revision_academica set vence_at=clock_timestamp(),estado=case when p_error then 'ERROR' else 'COMPLETADA' end,updated_at=now() where institucion_id=v_inst returning * into v_row;
 else raise exception 'REVIEW_INVALID_DECISION'; end if;
 return jsonb_build_object('id',v_row.id,'venceAt',v_row.vence_at,'estado',v_row.estado);
end $$;

create function public.academic_review_current(p_inst uuid, p_entity text, p_key text, p_person text default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_result jsonb;
begin
 if p_entity = 'ESTUDIANTE' then
   select jsonb_build_object('persona', jsonb_build_object(
    'identificadorOrigen',pf.identificador_origen,'tipoDocumento',pf.tipo_documento_reportado,'numeroDocumento',pf.numero_documento_reportado,
    'primerNombre',pf.primer_nombre_reportado,'segundoNombre',pf.segundo_nombre_reportado,'primerApellido',pf.primer_apellido_reportado,'segundoApellido',pf.segundo_apellido_reportado), 'credenciales','[]'::jsonb)
   into v_result from public.persona_fuentes pf where pf.institucion_id=p_inst and pf.identificador_origen=p_key;
 else
   select jsonb_build_object('identificadorOrigen',p_key,
    'contenido',jsonb_build_object('codigoOrigen',c.codigo_origen,'personaIdentificadorOrigen',case when exists(select 1 from public.persona_fuentes pf where pf.institucion_id=p_inst and pf.identificador_origen=p_person and pf.persona_id=c.persona_id) then p_person else null end,
      'programaCodigoOrigen',p.codigo_origen,'sedeCodigoOrigen',s.codigo_origen,'tipo',v.tipo,'categoria',v.categoria,'titulo',v.titulo,'descripcion',v.descripcion,
      'fechaEmision',v.fecha_emision,'fechaGrado',v.fecha_grado,'numeroActa',v.numero_acta,'numeroFolio',v.numero_folio,'numeroLibro',v.numero_libro,'documentoHashSha256',v.documento_hash_sha256),
    'estado',c.estado_actual,
    'programa',case when p.id is null then null else jsonb_build_object('codigoOrigen',p.codigo_origen,'codigoSnies',p.codigo_snies,'nombre',p.nombre,'nivelFormacion',p.nivel_formacion,'modalidad',p.modalidad,'facultad',p.facultad,'estado',p.estado) end,
    'sede',case when s.id is null then null else jsonb_build_object('codigoOrigen',s.codigo_origen,'nombre',s.nombre,'departamento',s.departamento,'municipio',s.municipio,'direccion',s.direccion,'estado',s.estado) end,
    'relacion',case when ps.id is null then null else jsonb_build_object('programaCodigoOrigen',p.codigo_origen,'sedeCodigoOrigen',s.codigo_origen,'jornada',ps.jornada,'modalidad',ps.modalidad,'estado',ps.estado) end)
   into v_result from public.credenciales c
   join public.credencial_versiones v on v.credencial_id=c.id and v.numero_version=c.version_actual
   left join public.programas p on p.id=c.programa_id left join public.sedes s on s.id=c.sede_id
   left join public.programa_sede ps on ps.programa_id=p.id and ps.sede_id=s.id
   where c.institucion_id=p_inst and c.codigo_origen=p_key;
   -- The caller uses the source row ID as fingerprint identity, not the code.
 end if;
 return coalesce(v_result,'{}'::jsonb);
end $$;

create function public.academic_review_record(p_integration uuid, p_entity text, p_key text, p_person text, p_code text, p_payload jsonb, p_updated timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_inst uuid; v_head public.origenes_revision_academica%rowtype; v_old public.solicitudes_revision_academica%rowtype;
 v_current jsonb; v_fp text; v_cfp text; v_id uuid:=gen_random_uuid(); v_seq bigint; v_type text;
begin
 select institucion_id into strict v_inst from public.integraciones_institucionales where id=p_integration and estado='ACTIVA';
 perform public.academic_review_lock(v_inst);
 if not exists(select 1 from public.cortes_revision_academica where institucion_id=v_inst) then raise exception 'REVIEW_BASELINE_REQUIRED'; end if;
 v_fp:=public.academic_review_fingerprint(v_inst,p_entity,p_key,p_payload);
 v_current:=public.academic_review_current(v_inst,p_entity,case when p_entity='CREDENCIAL' then p_code else p_key end,p_person);
 if p_entity='CREDENCIAL' and v_current <> '{}' then v_current:=jsonb_set(v_current,'{identificadorOrigen}',to_jsonb(p_key)); end if;
 v_cfp:=public.academic_review_fingerprint(v_inst,p_entity,p_key,v_current);
 select * into v_head from public.origenes_revision_academica where institucion_id=v_inst and entidad_tipo=p_entity and identificador_origen=p_key for update;
 if p_entity='CREDENCIAL' and v_head.recurso_raes_id is not null and not exists(select 1 from public.credenciales where id=v_head.recurso_raes_id and institucion_id=v_inst and codigo_origen=p_code) then raise exception 'REVIEW_SOURCE_IDENTITY_CONFLICT'; end if;
 if v_head.solicitud_actual_id is not null then select * into v_old from public.solicitudes_revision_academica where id=v_head.solicitud_actual_id for update; end if;
 if v_head.source_updated_at is not null and p_updated is not null and p_updated<v_head.source_updated_at then raise exception 'REVIEW_SOURCE_STALE'; end if;
 if v_head.fingerprint=v_fp and (v_old.id is null or v_old.estado<>'PENDIENTE' or v_old.fingerprint_canonico=v_cfp) then
   update public.origenes_revision_academica set source_updated_at=greatest(source_updated_at,p_updated) where institucion_id=v_inst and entidad_tipo=p_entity and identificador_origen=p_key;
   return jsonb_build_object('id',v_old.id,'estado',v_old.estado,'nueva',false);
 end if;
 v_seq:=coalesce(v_head.secuencia,0)+1;
 v_type:=case when p_entity='ESTUDIANTE' then case when v_current='{}' then 'NUEVO_ESTUDIANTE' else 'ACTUALIZACION_ESTUDIANTE' end else case when v_current='{}' then 'NUEVA_CREDENCIAL' else 'ACTUALIZACION_CREDENCIAL' end end;
 if v_old.estado='PENDIENTE' then
   update public.solicitudes_revision_academica set estado='SUPERSEDIDA',superseded_by_id=v_id where id=v_old.id;
   insert into public.auditoria(actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata) values('INTEGRACION',p_integration,'ACADEMIC_REVIEW_SUPERSEDED','REVISION_ACADEMICA',v_old.id,jsonb_build_object('sucesora',v_id));
 end if;
 insert into public.solicitudes_revision_academica(id,institucion_id,integracion_id,tipo,entidad_tipo,identificador_origen,persona_identificador_origen,credencial_codigo_origen,fingerprint,fingerprint_canonico,secuencia,source_updated_at,payload_propuesto,cambios_detectados,supersedes_id)
 values(v_id,v_inst,p_integration,v_type,p_entity,p_key,p_person,p_code,v_fp,v_cfp,v_seq,p_updated,p_payload,public.academic_review_changes(v_current,p_payload),case when v_old.estado='PENDIENTE' then v_old.id else null end);
 insert into public.origenes_revision_academica(institucion_id,entidad_tipo,identificador_origen,fingerprint,source_updated_at,secuencia,solicitud_actual_id)
 values(v_inst,p_entity,p_key,v_fp,p_updated,v_seq,v_id)
 on conflict (institucion_id,entidad_tipo,identificador_origen) do update set fingerprint=excluded.fingerprint,source_updated_at=excluded.source_updated_at,secuencia=excluded.secuencia,solicitud_actual_id=excluded.solicitud_actual_id;
 insert into public.auditoria(actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata) values('INTEGRACION',p_integration,'ACADEMIC_REVIEW_SUBMITTED','REVISION_ACADEMICA',v_id,jsonb_build_object('tipo',v_type,'secuencia',v_seq));
 return jsonb_build_object('id',v_id,'estado','PENDIENTE','nueva',true);
end $$;

create function public.presentar_revision_academica(p_integracion_id uuid, p_deteccion_id uuid, p_observacion jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_known boolean; v_person text; v_person_payload jsonb; v_c jsonb; v_clean jsonb; v_receipts jsonb:='[]'; v_result jsonb;
begin
 if jsonb_typeof(p_observacion)<>'object' or octet_length(p_observacion::text)>65536 then raise exception 'REVIEW_INVALID_PAYLOAD'; end if;
 select ii.institucion_id into v_inst from public.integraciones_institucionales ii join public.instituciones i on i.id=ii.institucion_id where ii.id=p_integracion_id and ii.estado='ACTIVA' and i.estado='ACTIVA';
 if v_inst is null then raise exception 'REVIEW_INVALID_INTEGRATION'; end if;
 if not exists(select 1 from public.integracion_scopes x join public.scopes s on s.id=x.scope_id where x.integracion_id=p_integracion_id and s.codigo='academic-review:submit') then raise exception 'REVIEW_FORBIDDEN'; end if;
 perform public.academic_review_lock(v_inst);
 if not exists(select 1 from public.detecciones_revision_academica where institucion_id=v_inst and id=p_deteccion_id and vence_at>clock_timestamp()) then raise exception 'REVIEW_DETECTION_EXPIRED'; end if;
 update public.detecciones_revision_academica set vence_at=clock_timestamp()+interval '120 seconds' where institucion_id=v_inst and id=p_deteccion_id;
 v_person:=p_observacion#>>'{persona,identificadorOrigen}';
 if v_person is null or length(v_person) not between 1 and 150 or jsonb_typeof(p_observacion->'credenciales')<>'array' or jsonb_array_length(p_observacion->'credenciales')>50 then raise exception 'REVIEW_INVALID_PAYLOAD'; end if;
 select exists(select 1 from public.persona_fuentes where institucion_id=v_inst and identificador_origen=v_person) into v_known;
 select coalesce(jsonb_agg(value order by (value->>'identificadorOrigen') collate "C"),'[]'::jsonb) into v_clean from jsonb_array_elements(p_observacion->'credenciales');
 v_person_payload:=jsonb_build_object('persona',p_observacion->'persona','credenciales',case when v_known then '[]'::jsonb else v_clean end);
 v_result:=public.academic_review_record(p_integracion_id,'ESTUDIANTE',v_person,v_person,null,v_person_payload,(p_observacion->>'sourceUpdatedAt')::timestamptz);
 v_receipts:=v_receipts||jsonb_build_array(v_result);
 if v_known then
  for v_c in select value from jsonb_array_elements(p_observacion->'credenciales') loop
   if v_c#>>'{contenido,personaIdentificadorOrigen}' is distinct from v_person then raise exception 'REVIEW_IDENTITY_CONFLICT'; end if;
   v_result:=public.academic_review_record(p_integracion_id,'CREDENCIAL',v_c->>'identificadorOrigen',v_person,v_c#>>'{contenido,codigoOrigen}',v_c-'sourceUpdatedAt',(v_c->>'sourceUpdatedAt')::timestamptz);
   v_receipts:=v_receipts||jsonb_build_array(v_result);
  end loop;
 end if;
 return jsonb_build_object('observaciones',v_receipts);
end $$;

create function public.preparar_baseline_revision_academica(p_integracion_id uuid, p_observaciones jsonb, p_catalogos jsonb, p_check boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_cut uuid; v_o jsonb; v_c jsonb; v_p jsonb; v_person text; v_resource uuid; v_fp text; v_id text; v_kind text; v_list jsonb; v_item jsonb; v_unknown jsonb:='[]'; v_counts jsonb; v_total integer;
begin
 select ii.institucion_id into v_inst from public.integraciones_institucionales ii join public.instituciones i on i.id=ii.institucion_id where ii.id=p_integracion_id and ii.estado='ACTIVA' and i.estado='ACTIVA';
 if v_inst is null then raise exception 'REVIEW_INVALID_INTEGRATION'; end if;
 perform public.academic_review_lock(v_inst);
 if p_check is null then raise exception 'REVIEW_INVALID_PAYLOAD'; end if;
 if jsonb_typeof(p_observaciones)<>'array' or jsonb_array_length(p_observaciones)>10000 or octet_length(p_observaciones::text)+octet_length(p_catalogos::text)>4194304 then raise exception 'REVIEW_BASELINE_TOO_LARGE'; end if;
 v_total:=jsonb_array_length(p_observaciones);
 v_counts:=jsonb_build_object('ESTUDIANTE',v_total,'CREDENCIAL',0,'PROGRAMA',jsonb_array_length(p_catalogos->'programas'),'SEDE',jsonb_array_length(p_catalogos->'sedes'),'PROGRAMA_SEDE',jsonb_array_length(p_catalogos->'relaciones'));
 -- Preflight all references before writing even the cut marker.
 for v_o in select value from jsonb_array_elements(p_observaciones) loop
  v_person:=v_o#>>'{persona,identificadorOrigen}';
  if not exists(select 1 from public.persona_fuentes pf join public.personas_maestra m on m.id=pf.persona_id where pf.institucion_id=v_inst and pf.identificador_origen=v_person and m.tipo_documento=v_o#>>'{persona,tipoDocumento}' and m.numero_documento=v_o#>>'{persona,numeroDocumento}') then
   v_unknown:=v_unknown||jsonb_build_array(jsonb_build_object('entidad','ESTUDIANTE','origen',v_person));
  end if;
  for v_c in select value from jsonb_array_elements(v_o->'credenciales') loop
   if not exists(select 1 from public.credenciales c join public.persona_fuentes pf on pf.persona_id=c.persona_id and pf.institucion_id=c.institucion_id where c.institucion_id=v_inst and c.codigo_origen=v_c#>>'{contenido,codigoOrigen}' and pf.identificador_origen=v_person) then
    v_unknown:=v_unknown||jsonb_build_array(jsonb_build_object('entidad','CREDENCIAL','origen',v_c->>'identificadorOrigen','codigo',v_c#>>'{contenido,codigoOrigen}'));
   end if;
   v_counts:=jsonb_set(v_counts,'{CREDENCIAL}',to_jsonb((v_counts->>'CREDENCIAL')::int+1));
  end loop;
 end loop;
 for v_kind,v_list in select * from (values('PROGRAMA',p_catalogos->'programas'),('SEDE',p_catalogos->'sedes'),('PROGRAMA_SEDE',p_catalogos->'relaciones')) as x(kind,items) loop
  for v_item in select value from jsonb_array_elements(v_list) loop
   v_resource:=null; v_p:=v_item->'payload';
   if v_kind='PROGRAMA' then select id into v_resource from public.programas where institucion_id=v_inst and codigo_origen=v_p->>'codigoOrigen';
   elsif v_kind='SEDE' then select id into v_resource from public.sedes where institucion_id=v_inst and codigo_origen=v_p->>'codigoOrigen';
   else select ps.id into v_resource from public.programa_sede ps join public.programas p on p.id=ps.programa_id join public.sedes s on s.id=ps.sede_id where p.institucion_id=v_inst and s.institucion_id=v_inst and p.codigo_origen=v_p->>'programaCodigoOrigen' and s.codigo_origen=v_p->>'sedeCodigoOrigen'; end if;
   if v_resource is null then v_unknown:=v_unknown||jsonb_build_array(jsonb_build_object('entidad',v_kind,'origen',v_item->>'identificadorOrigen')); end if;
  end loop;
 end loop;
 if v_unknown<>'[]' then return jsonb_build_object('ready',false,'cantidades',v_counts,'desconocidos',v_unknown,'aplicado',false); end if;
 select id into v_cut from public.cortes_revision_academica where institucion_id=v_inst;
 if v_cut is not null then return jsonb_build_object('ready',true,'cantidades',v_counts,'desconocidos','[]'::jsonb,'aplicado',false,'existente',true); end if;
 if p_check then return jsonb_build_object('ready',true,'cantidades',v_counts,'desconocidos','[]'::jsonb,'aplicado',false); end if;
 insert into public.cortes_revision_academica(institucion_id,integracion_id,cantidades) values(v_inst,p_integracion_id,v_counts) returning id into v_cut;
 for v_o in select value from jsonb_array_elements(p_observaciones) loop
  v_person:=v_o#>>'{persona,identificadorOrigen}';
  select persona_id into strict v_resource from public.persona_fuentes where institucion_id=v_inst and identificador_origen=v_person;
  v_p:=jsonb_build_object('persona',v_o->'persona','credenciales','[]'::jsonb);
  insert into public.origenes_revision_academica(institucion_id,entidad_tipo,identificador_origen,fingerprint,source_updated_at,corte_id,recurso_raes_id)
   values(v_inst,'ESTUDIANTE',v_person,public.academic_review_fingerprint(v_inst,'ESTUDIANTE',v_person,v_p),(v_o->>'sourceUpdatedAt')::timestamptz,v_cut,v_resource);
  for v_c in select value from jsonb_array_elements(v_o->'credenciales') loop
   v_id:=v_c->>'identificadorOrigen';
   select id into strict v_resource from public.credenciales where institucion_id=v_inst and codigo_origen=v_c#>>'{contenido,codigoOrigen}';
   insert into public.origenes_revision_academica(institucion_id,entidad_tipo,identificador_origen,fingerprint,source_updated_at,corte_id,recurso_raes_id)
    values(v_inst,'CREDENCIAL',v_id,public.academic_review_fingerprint(v_inst,'CREDENCIAL',v_id,v_c-'sourceUpdatedAt'),(v_c->>'sourceUpdatedAt')::timestamptz,v_cut,v_resource);
  end loop;
 end loop;
 for v_kind,v_list in select * from (values('PROGRAMA',p_catalogos->'programas'),('SEDE',p_catalogos->'sedes'),('PROGRAMA_SEDE',p_catalogos->'relaciones')) as x(kind,items) loop
  for v_item in select value from jsonb_array_elements(v_list) loop
   v_id:=v_item->>'identificadorOrigen';
   insert into public.origenes_revision_academica(institucion_id,entidad_tipo,identificador_origen,fingerprint,corte_id,source_updated_at)
    values(v_inst,v_kind,v_id,public.academic_review_fingerprint(v_inst,v_kind,v_id,v_item->'payload'),v_cut,(v_item->>'sourceUpdatedAt')::timestamptz);
  end loop;
 end loop;
 insert into public.huellas_baseline_revision_academica(corte_id,entidad_tipo,identificador_origen,fingerprint,source_updated_at,recurso_raes_id) select v_cut,entidad_tipo,identificador_origen,fingerprint,source_updated_at,recurso_raes_id from public.origenes_revision_academica where corte_id=v_cut;
 insert into public.auditoria(actor_tipo,accion,recurso_tipo,recurso_id,metadata) values('SISTEMA','ACADEMIC_REVIEW_BASELINED','INSTITUCION',v_inst,jsonb_build_object('cantidades',v_counts,'corte_id',v_cut));
 return jsonb_build_object('ready',true,'cantidades',v_counts,'desconocidos','[]'::jsonb,'aplicado',true,'corteId',v_cut);
end $$;

-- Internal mutation helpers; never executable through the service/browser API.
create function public.academic_review_apply_person(p_inst uuid, p_person jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_person uuid; v_master public.personas_maestra%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('review-person:'||(p_person->>'tipoDocumento')||':'||(p_person->>'numeroDocumento'),0));
 select m.* into v_master from public.persona_fuentes pf join public.personas_maestra m on m.id=pf.persona_id where pf.institucion_id=p_inst and pf.identificador_origen=p_person->>'identificadorOrigen' for update of m;
 if found then
  if v_master.tipo_documento is distinct from p_person->>'tipoDocumento' or v_master.numero_documento is distinct from p_person->>'numeroDocumento' then raise exception 'REVIEW_IDENTITY_CHANGE_BLOCKED'; end if;
  v_person:=v_master.id;
 else
  insert into public.personas_maestra(tipo_documento,numero_documento,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido)
   values(p_person->>'tipoDocumento',p_person->>'numeroDocumento',p_person->>'primerNombre',p_person->>'segundoNombre',p_person->>'primerApellido',p_person->>'segundoApellido') on conflict (tipo_documento,numero_documento) do nothing;
  select id into strict v_person from public.personas_maestra where tipo_documento=p_person->>'tipoDocumento' and numero_documento=p_person->>'numeroDocumento';
 end if;
 insert into public.persona_fuentes(persona_id,institucion_id,identificador_origen,tipo_documento_reportado,numero_documento_reportado,primer_nombre_reportado,segundo_nombre_reportado,primer_apellido_reportado,segundo_apellido_reportado,last_seen_at)
 values(v_person,p_inst,p_person->>'identificadorOrigen',p_person->>'tipoDocumento',p_person->>'numeroDocumento',p_person->>'primerNombre',p_person->>'segundoNombre',p_person->>'primerApellido',p_person->>'segundoApellido',now())
 on conflict (institucion_id,identificador_origen) do update set primer_nombre_reportado=excluded.primer_nombre_reportado,segundo_nombre_reportado=excluded.segundo_nombre_reportado,primer_apellido_reportado=excluded.primer_apellido_reportado,segundo_apellido_reportado=excluded.segundo_apellido_reportado,last_seen_at=excluded.last_seen_at;
 return v_person;
end $$;

create function public.academic_review_apply_credential(p_request public.solicitudes_revision_academica, p_credential jsonb) returns uuid
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
 on conflict (institucion_id,codigo_origen) do update set codigo_snies=excluded.codigo_snies,nombre=excluded.nombre,nivel_formacion=excluded.nivel_formacion,modalidad=excluded.modalidad,facultad=excluded.facultad,estado=excluded.estado returning id into v_program_id;
 insert into public.sedes(institucion_id,codigo_origen,nombre,departamento,municipio,direccion,estado)
 values(p_request.institucion_id,v_campus->>'codigoOrigen',v_campus->>'nombre',v_campus->>'departamento',v_campus->>'municipio',v_campus->>'direccion',v_campus->>'estado')
 on conflict (institucion_id,codigo_origen) do update set nombre=excluded.nombre,departamento=excluded.departamento,municipio=excluded.municipio,direccion=excluded.direccion,estado=excluded.estado returning id into v_campus_id;
 insert into public.programa_sede(programa_id,sede_id,jornada,modalidad,estado) values(v_program_id,v_campus_id,v_relation->>'jornada',v_relation->>'modalidad',v_relation->>'estado')
 on conflict (programa_id,sede_id) do update set jornada=excluded.jornada,modalidad=excluded.modalidad,estado=excluded.estado;
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

create function public.decidir_revision_academica(p_solicitud_id uuid, p_admin_id uuid, p_accion text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_request public.solicitudes_revision_academica%rowtype; v_head public.origenes_revision_academica%rowtype; v_inst uuid; v_current jsonb; v_person uuid; v_resource uuid; v_c jsonb; v_fp text;
begin
 if p_accion is null or p_accion not in ('APROBAR','RECHAZAR') or p_motivo is null or length(btrim(p_motivo)) not between 3 and 1000 then raise exception 'REVIEW_INVALID_DECISION'; end if;
 perform 1 from public.perfiles_admin where id=p_admin_id and estado='ACTIVO' and rol in ('ADMIN','SUPERADMIN') for share;
 if not found then raise exception 'REVIEW_FORBIDDEN'; end if;
 select institucion_id into v_inst from public.solicitudes_revision_academica where id=p_solicitud_id;
 if v_inst is null then raise exception 'REVIEW_NOT_FOUND'; end if;
 perform public.academic_review_lock(v_inst);
 select * into strict v_request from public.solicitudes_revision_academica where id=p_solicitud_id for update;
 if (p_accion='APROBAR' and v_request.estado='APROBADA') or (p_accion='RECHAZAR' and v_request.estado='RECHAZADA' and v_request.motivo_decision=btrim(p_motivo)) then
  return jsonb_build_object('id',v_request.id,'estado',v_request.estado,'recursoRaesId',v_request.recurso_raes_id,'replayed',true);
 end if;
 select * into v_head from public.origenes_revision_academica where institucion_id=v_inst and entidad_tipo=v_request.entidad_tipo and identificador_origen=v_request.identificador_origen for update;
 if v_request.estado<>'PENDIENTE' or v_head.solicitud_actual_id is distinct from v_request.id or v_head.fingerprint is distinct from v_request.fingerprint then raise exception 'REVIEW_STALE'; end if;
 if p_accion='RECHAZAR' then
  update public.solicitudes_revision_academica set estado='RECHAZADA',revisada_at=now(),revisada_por=p_admin_id,motivo_decision=btrim(p_motivo) where id=v_request.id;
 else
  if not exists(select 1 from public.integraciones_institucionales ii join public.instituciones i on i.id=ii.institucion_id where ii.id=v_request.integracion_id and ii.institucion_id=v_inst and ii.estado='ACTIVA' and i.estado='ACTIVA') then raise exception 'REVIEW_INVALID_INTEGRATION'; end if;
  v_current:=public.academic_review_current(v_inst,v_request.entidad_tipo,case when v_request.entidad_tipo='CREDENCIAL' then v_request.credencial_codigo_origen else v_request.identificador_origen end,v_request.persona_identificador_origen);
  if v_request.entidad_tipo='CREDENCIAL' and v_current<>'{}' then v_current:=jsonb_set(v_current,'{identificadorOrigen}',to_jsonb(v_request.identificador_origen)); end if;
  if public.academic_review_fingerprint(v_inst,v_request.entidad_tipo,v_request.identificador_origen,v_current)<>v_request.fingerprint_canonico then raise exception 'REVIEW_CANONICAL_CHANGED'; end if;
  -- Mark first within this transaction so canonical guards can verify the context.
  -- Any failure below rolls back the status, academic writes, heads and audit.
  update public.solicitudes_revision_academica set estado='APROBADA',revisada_at=now(),revisada_por=p_admin_id,motivo_decision=btrim(p_motivo) where id=v_request.id returning * into v_request;
  perform set_config('raes.academic_review_id',v_request.id::text,true);
  if v_request.entidad_tipo='ESTUDIANTE' then
   v_person:=public.academic_review_apply_person(v_inst,v_request.payload_propuesto->'persona');
   v_resource:=v_person;
   for v_c in select value from jsonb_array_elements(v_request.payload_propuesto->'credenciales') loop
    v_resource:=public.academic_review_apply_credential(v_request,v_c);
    v_fp:=public.academic_review_fingerprint(v_inst,'CREDENCIAL',v_c->>'identificadorOrigen',v_c);
    insert into public.origenes_revision_academica(institucion_id,entidad_tipo,identificador_origen,fingerprint,recurso_raes_id,source_updated_at,solicitud_actual_id)
     values(v_inst,'CREDENCIAL',v_c->>'identificadorOrigen',v_fp,v_resource,(v_c->>'sourceUpdatedAt')::timestamptz,v_request.id)
     on conflict (institucion_id,entidad_tipo,identificador_origen) do update set fingerprint=excluded.fingerprint,recurso_raes_id=excluded.recurso_raes_id,source_updated_at=excluded.source_updated_at,solicitud_actual_id=excluded.solicitud_actual_id;
   end loop;
   v_resource:=v_person;
   -- Normalize grouped creation into its independent known components.
   update public.origenes_revision_academica set fingerprint=public.academic_review_fingerprint(v_inst,'ESTUDIANTE',v_request.identificador_origen,jsonb_build_object('persona',v_request.payload_propuesto->'persona','credenciales','[]'::jsonb)),recurso_raes_id=v_person where institucion_id=v_inst and entidad_tipo='ESTUDIANTE' and identificador_origen=v_request.identificador_origen;
  else
   v_resource:=public.academic_review_apply_credential(v_request,v_request.payload_propuesto);
  end if;
  update public.solicitudes_revision_academica set recurso_raes_id=v_resource where id=v_request.id;
  update public.origenes_revision_academica set recurso_raes_id=v_resource where institucion_id=v_inst and entidad_tipo=v_request.entidad_tipo and identificador_origen=v_request.identificador_origen;
  perform set_config('raes.academic_review_id','',true);
 end if;
 insert into public.auditoria(actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata) values('ADMIN',p_admin_id,case when p_accion='APROBAR' then 'ACADEMIC_REVIEW_APPROVED' else 'ACADEMIC_REVIEW_REJECTED' end,'REVISION_ACADEMICA',v_request.id,jsonb_build_object('tipo',v_request.tipo,'institucion_id',v_inst,'secuencia',v_request.secuencia));
 return jsonb_build_object('id',v_request.id,'estado',case when p_accion='APROBAR' then 'APROBADA' else 'RECHAZADA' end,'recursoRaesId',v_resource,'replayed',false);
end $$;

create function public.academic_review_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_request public.solicitudes_revision_academica%rowtype; v_id text;
begin
 -- A caller cannot forge an approval context with set_config. Only the owner
 -- executing the decision RPC may reach canonical mutations.
 if current_user <> pg_catalog.pg_get_userbyid((select proowner from pg_catalog.pg_proc where oid='public.decidir_revision_academica(uuid,uuid,text,text)'::regprocedure)) then raise exception 'REVIEW_APPROVAL_REQUIRED'; end if;
 v_id:=current_setting('raes.academic_review_id',true);
 if v_id is null or v_id='' then raise exception 'REVIEW_APPROVAL_REQUIRED'; end if;
 select * into v_request from public.solicitudes_revision_academica where id=v_id::uuid and estado='APROBADA' and revisada_por is not null and revisada_at is not null;
 if not found then raise exception 'REVIEW_APPROVAL_REQUIRED'; end if;
 if tg_table_name in ('persona_fuentes','credenciales','programas','sedes') and (to_jsonb(new)->>'institucion_id')::uuid<>v_request.institucion_id then raise exception 'REVIEW_INSTITUTION_CONFLICT'; end if;
 return new;
end $$;
-- Browser grants cannot bypass row triggers through TRUNCATE or direct writes.
revoke all on public.personas_maestra, public.persona_fuentes, public.credenciales,
 public.credencial_versiones, public.credencial_eventos, public.programas, public.sedes,
 public.programa_sede from public, anon, authenticated;
revoke truncate on public.personas_maestra, public.persona_fuentes, public.credenciales,
 public.credencial_versiones, public.credencial_eventos, public.programas, public.sedes,
 public.programa_sede from service_role;
-- DB-level enforcement also protects against an old API/connector still running.
create trigger trg_review_gate before update on public.instituciones for each row
 when (old.nit is distinct from new.nit or old.nombre is distinct from new.nombre or old.codigo_snies is distinct from new.codigo_snies or old.tipo_institucion is distinct from new.tipo_institucion or old.estado is distinct from new.estado)
 execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.personas_maestra for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.persona_fuentes for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.credenciales for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.credencial_versiones for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.credencial_eventos for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.programas for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.sedes for each row execute function public.academic_review_guard();
create trigger trg_review_gate before insert or update or delete on public.programa_sede for each row execute function public.academic_review_guard();

insert into public.scopes(codigo,descripcion) values('academic-review:submit','Reportar propuestas académicas para revisión administrativa') on conflict(codigo) do nothing;
insert into public.integracion_scopes(integracion_id,scope_id) select ii.id,s.id from public.integraciones_institucionales ii cross join public.scopes s where ii.estado='ACTIVA' and s.codigo='academic-review:submit' on conflict do nothing;
create function public.listar_revisiones_academicas(p_admin_id uuid, p_filtros jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_page int:=coalesce((p_filtros->>'page')::int,1); v_size int:=coalesce((p_filtros->>'pageSize')::int,20); v_result jsonb;
begin
 perform 1 from public.perfiles_admin where id=p_admin_id and estado='ACTIVO' and rol in ('ADMIN','SUPERADMIN','AUDITOR') for share;
 if not found then raise exception 'REVIEW_FORBIDDEN'; end if;
 if v_page not between 1 and 10000 or v_size not between 1 and 100 or length(coalesce(p_filtros->>'q',''))>150 then raise exception 'REVIEW_INVALID_FILTER'; end if;
 with filtered as (
  select r.*,i.nombre as institucion_nombre,coalesce(r.payload_propuesto#>>'{persona,primerNombre}',pf.primer_nombre_reportado,'') as primer_nombre,
    coalesce(r.payload_propuesto#>>'{persona,primerApellido}',pf.primer_apellido_reportado,'') as primer_apellido
  from public.solicitudes_revision_academica r join public.instituciones i on i.id=r.institucion_id
  left join public.persona_fuentes pf on pf.institucion_id=r.institucion_id and pf.identificador_origen=r.persona_identificador_origen
  where (not(p_filtros ? 'estado') or r.estado=p_filtros->>'estado')
    and (not(p_filtros ? 'tipo') or r.tipo=p_filtros->>'tipo')
    and (not(p_filtros ? 'institucion') or r.institucion_id=(p_filtros->>'institucion')::uuid)
    and (not(p_filtros ? 'desde') or r.detectada_at>=((p_filtros->>'desde')::date::timestamp at time zone 'America/Bogota'))
    and (not(p_filtros ? 'hasta') or r.detectada_at<(((p_filtros->>'hasta')::date+1)::timestamp at time zone 'America/Bogota'))
    and (not(p_filtros ? 'q') or position(lower(p_filtros->>'q') in lower(r.identificador_origen||' '||coalesce(r.credencial_codigo_origen,'')))>0)
 ), page as (select * from filtered order by detectada_at desc,id desc limit v_size offset (v_page-1)*v_size)
 select jsonb_build_object('data',coalesce((select jsonb_agg(jsonb_build_object('id',id,'institucion',jsonb_build_object('id',institucion_id,'nombre',institucion_nombre),'tipo',tipo,'estado',estado,'identificadorOrigen',identificador_origen,'personaNombre',btrim(primer_nombre||' '||primer_apellido),'credencialCodigoOrigen',credencial_codigo_origen,'detectadaAt',detectada_at,'camposModificados',to_jsonb(array(select jsonb_object_keys(cambios_detectados)))) order by detectada_at desc,id desc) from page),'[]'::jsonb),'meta',jsonb_build_object('page',v_page,'pageSize',v_size,'total',(select count(*) from filtered))) into v_result;
 insert into public.auditoria(actor_tipo,actor_id,accion,recurso_tipo,metadata) values('ADMIN',p_admin_id,'ACADEMIC_REVIEW_READ','REVISION_ACADEMICA',jsonb_build_object('operacion','LIST','page',v_page,'page_size',v_size));
 return v_result;
end $$;

create function public.obtener_revision_academica(p_admin_id uuid, p_solicitud_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r public.solicitudes_revision_academica%rowtype; v_actual jsonb; v_blocks jsonb:='[]'; v_name text; v_result jsonb;
begin
 perform 1 from public.perfiles_admin where id=p_admin_id and estado='ACTIVO' and rol in ('ADMIN','SUPERADMIN','AUDITOR') for share;
 if not found then raise exception 'REVIEW_FORBIDDEN'; end if;
 select * into v_r from public.solicitudes_revision_academica where id=p_solicitud_id;
 if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
 select nombre into v_name from public.instituciones where id=v_r.institucion_id;
 v_actual:=public.academic_review_current(v_r.institucion_id,v_r.entidad_tipo,case when v_r.entidad_tipo='CREDENCIAL' then v_r.credencial_codigo_origen else v_r.identificador_origen end,v_r.persona_identificador_origen);
 if v_r.entidad_tipo='CREDENCIAL' and v_actual<>'{}' then v_actual:=jsonb_set(v_actual,'{identificadorOrigen}',to_jsonb(v_r.identificador_origen)); end if;
 if v_r.entidad_tipo='CREDENCIAL' and v_actual->>'estado' in ('REVOCADA','ANULADA') and public.academic_review_content(v_actual) is distinct from public.academic_review_content(v_r.payload_propuesto) then v_blocks:=v_blocks||'"ESTADO_TERMINAL"'::jsonb; end if;
 if v_r.entidad_tipo='ESTUDIANTE' and v_actual<>'{}' and (v_actual#>>'{persona,tipoDocumento}' is distinct from v_r.payload_propuesto#>>'{persona,tipoDocumento}' or v_actual#>>'{persona,numeroDocumento}' is distinct from v_r.payload_propuesto#>>'{persona,numeroDocumento}') then v_blocks:=v_blocks||'"CAMBIO_IDENTIDAD"'::jsonb; end if;
 if v_r.estado='PENDIENTE' and public.academic_review_fingerprint(v_r.institucion_id,v_r.entidad_tipo,v_r.identificador_origen,v_actual)<>v_r.fingerprint_canonico then v_blocks:=v_blocks||'"CANONICO_MODIFICADO"'::jsonb; end if;
 v_result:=jsonb_build_object('data',jsonb_build_object('id',v_r.id,'institucion',jsonb_build_object('id',v_r.institucion_id,'nombre',v_name),'tipo',v_r.tipo,'estado',v_r.estado,'identificadorOrigen',v_r.identificador_origen,'personaIdentificadorOrigen',v_r.persona_identificador_origen,'credencialCodigoOrigen',v_r.credencial_codigo_origen,'detectadaAt',v_r.detectada_at,'revisadaAt',v_r.revisada_at,'motivoDecision',v_r.motivo_decision,'actual',v_actual,'propuesto',v_r.payload_propuesto,'cambios',public.academic_review_changes(v_actual,v_r.payload_propuesto),'bloqueos',v_blocks));
 insert into public.auditoria(actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata) values('ADMIN',p_admin_id,'ACADEMIC_REVIEW_READ','REVISION_ACADEMICA',v_r.id,jsonb_build_object('operacion','DETAIL'));
 return v_result;
end $$;

-- Restrict new entry points; helpers are callable only by their owner/trigger context.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'academic_review_%' or p.proname in ('presentar_revision_academica','preparar_baseline_revision_academica','decidir_revision_academica','controlar_deteccion_academica','listar_revisiones_academicas','obtener_revision_academica')) loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role',f.signature);
 end loop;
end $$;
grant execute on function public.presentar_revision_academica(uuid,uuid,jsonb), public.preparar_baseline_revision_academica(uuid,jsonb,jsonb,boolean), public.decidir_revision_academica(uuid,uuid,text,text), public.controlar_deteccion_academica(uuid,text,uuid,boolean), public.listar_revisiones_academicas(uuid,jsonb), public.obtener_revision_academica(uuid,uuid) to service_role;
-- Retain historical functions unchanged, but remove direct API execution.
revoke execute on function public.registrar_credencial_inicial(uuid,varchar,varchar,varchar,varchar,varchar,varchar,varchar,varchar,varchar,varchar,text,date,date,varchar,varchar,varchar,varchar,jsonb) from service_role;
revoke execute on function public.corregir_credencial(uuid,varchar,varchar,varchar,varchar,text,timestamptz,varchar,varchar,varchar,varchar,varchar,text,date,date,varchar,varchar,varchar,varchar,jsonb) from service_role;
revoke execute on function public.transicionar_estado_credencial(uuid,varchar,varchar,varchar,varchar,varchar,text,timestamptz,jsonb) from service_role;
commit;
