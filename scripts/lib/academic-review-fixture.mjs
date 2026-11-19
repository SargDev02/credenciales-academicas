import { createReviewDb } from './academic-review-db.mjs';
export const ids={ institution:'00000000-0000-4000-8000-000000000001', otherInstitution:'00000000-0000-4000-8000-000000000002', integration:'00000000-0000-4000-8000-000000000101', otherIntegration:'00000000-0000-4000-8000-000000000102', admin:'00000000-0000-4000-8000-000000000301',auditor:'00000000-0000-4000-8000-000000000302'};
export function observation({ fresh=false }={}) {
 const key=fresh?'new':'known';
 return { persona:{identificadorOrigen:`student-${key}`,tipoDocumento:'CC',numeroDocumento:`SYNTH-REVIEW-${key}`,primerNombre:'Sintética',segundoNombre:null,primerApellido:'Revisión',segundoApellido:null},sourceUpdatedAt:'2026-11-09T10:00:00Z',credenciales:[{
  identificadorOrigen:`credential-${key}`, sourceUpdatedAt:'2026-11-09T10:00:00Z',estado:'VIGENTE',
  contenido:{codigoOrigen:`SYNTH-REVIEW-${key}-001`,personaIdentificadorOrigen:`student-${key}`,programaCodigoOrigen:'PROGRAM',sedeCodigoOrigen:'CAMPUS',tipo:'DIPLOMA',categoria:'TITULO',titulo:'Título sintético inicial',descripcion:null,fechaEmision:'2026-11-01',fechaGrado:null,numeroActa:null,numeroFolio:null,numeroLibro:null,documentoHashSha256:null},
  programa:{codigoOrigen:'PROGRAM',codigoSnies:null,nombre:'Programa sintético',nivelFormacion:null,modalidad:null,facultad:null,estado:'ACTIVO'},
  sede:{codigoOrigen:'CAMPUS',nombre:'Sede sintética',departamento:null,municipio:null,direccion:null,estado:'ACTIVA'},
  relacion:{programaCodigoOrigen:'PROGRAM',sedeCodigoOrigen:'CAMPUS',jornada:null,modalidad:null,estado:'ACTIVO'}
 }]};
}
export function catalogs(o=observation()) {const c=o.credenciales[0]; return {programas:[{identificadorOrigen:'program-id',payload:c.programa}],sedes:[{identificadorOrigen:'campus-id',payload:c.sede}],relaciones:[{identificadorOrigen:'relation-id',payload:c.relacion}]};}
export async function rpc(db,name,args) {
 const keys=Object.keys(args),values=Object.values(args).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v);
 return (await db.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) result`,values)).rows[0].result;
}
export async function seed(db) {
 await db.query(`insert into instituciones(id,nit,nombre,tipo_institucion) values($1,'SYNTH-1','Institución sintética A','UNIVERSIDAD'),($2,'SYNTH-2','Institución sintética B','UNIVERSIDAD')`,[ids.institution,ids.otherInstitution]);
 await db.query(`insert into integraciones_institucionales(id,institucion_id,nombre,client_id) values($1,$2,'Conector sintético A','fixture-review-a'),($3,$4,'Conector sintético B','fixture-review-b')`,[ids.integration,ids.institution,ids.otherIntegration,ids.otherInstitution]);
 await db.query(`insert into auth.users(id) values($1),($2)`,[ids.admin,ids.auditor]);
 await db.query(`insert into perfiles_admin(id,nombres,apellidos,rol) values($1,'Admin','Sintético','ADMIN'),($2,'Auditor','Sintético','AUDITOR')`,[ids.admin,ids.auditor]);
 const o=observation(),c=o.credenciales[0];
 await db.query(`insert into programas(institucion_id,codigo_origen,nombre) values($1,'PROGRAM',$2)`,[ids.institution,c.programa.nombre]);
 await db.query(`insert into sedes(institucion_id,codigo_origen,nombre) values($1,'CAMPUS',$2)`,[ids.institution,c.sede.nombre]);
 await db.query(`insert into programa_sede(programa_id,sede_id) select p.id,s.id from programas p cross join sedes s where p.institucion_id=$1 and s.institucion_id=$1`,[ids.institution]);
 const master=(await db.query(`insert into personas_maestra(tipo_documento,numero_documento,primer_nombre,primer_apellido) values('CC',$1,'Sintética','Revisión') returning id`,[o.persona.numeroDocumento])).rows[0].id;
 await db.query(`insert into persona_fuentes(persona_id,institucion_id,identificador_origen,tipo_documento_reportado,numero_documento_reportado,primer_nombre_reportado,primer_apellido_reportado) values($1,$2,$3,'CC',$4,'Sintética','Revisión')`,[master,ids.institution,o.persona.identificadorOrigen,o.persona.numeroDocumento]);
 await rpc(db,'registrar_credencial_inicial',{p_integracion_id:ids.integration,p_request_id:'historical-operation',p_idempotency_key:'external-key',p_request_hash:'a'.repeat(64),p_persona_identificador_origen:o.persona.identificadorOrigen,p_programa_codigo_origen:'PROGRAM',p_sede_codigo_origen:'CAMPUS',p_codigo_origen:c.contenido.codigoOrigen,p_tipo:'DIPLOMA',p_categoria:'TITULO',p_titulo:c.contenido.titulo,p_descripcion:null,p_fecha_emision:'2026-11-01',p_fecha_grado:null,p_numero_acta:null,p_numero_folio:null,p_numero_libro:null,p_documento_hash_sha256:null,p_payload_original:c.contenido});
}
export async function fixture() { return createReviewDb({beforeReview:seed}); }
export async function baseline(db,{check=false,observations=[observation()],integration=ids.integration,catalog=catalogs()}={}) {return rpc(db,'preparar_baseline_revision_academica',{p_integracion_id:integration,p_observaciones:observations,p_catalogos:catalog,p_check:check});}
export async function beginDetection(db,integration=ids.integration) {return rpc(db,'controlar_deteccion_academica',{p_integracion_id:integration,p_accion:'INICIAR'});}
export async function submit(db,obs,lease,integration=ids.integration) {return rpc(db,'presentar_revision_academica',{p_integracion_id:integration,p_deteccion_id:lease.id,p_observacion:obs});}
export async function decision(db,id,{action='APROBAR',actor=ids.admin,reason='Revisión sintética aprobada'}={}) {return rpc(db,'decidir_revision_academica',{p_solicitud_id:id,p_admin_id:actor,p_accion:action,p_motivo:reason});}
export async function snapshot(db) {
 const result={}; for(const table of ['personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos'])result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') data from public.${table} t`)).rows[0].data;
 return result;
}
