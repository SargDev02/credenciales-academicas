import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createReviewDb } from '../lib/academic-review-db.mjs';
import { ids, observation, rpc, fixture, baseline, beginDetection, submit, decision, snapshot } from '../lib/academic-review-fixture.mjs';
async function scenario(run){const db=await fixture();try{await run(db);}finally{await db.close();}}
async function changed(db){await baseline(db);const lease=await beginDetection(db);const o=observation();o.credenciales[0].contenido.titulo='Título sintético modificado';return {lease,o,result:await submit(db,o,lease)};}
const requestId = result => result.observaciones.find(v=>v.nueva)?.id;
test('empty RAES installation reconstructs historical DDL and academic review migration',async()=>{const db=await createReviewDb();try{assert.equal((await db.query('select count(*)::int n from solicitudes_revision_academica')).rows[0].n,0);}finally{await db.close();}});
test('canonical JSON + SHA-256 match deterministic cross-language vectors',()=>scenario(async db=>{
 const content={z:null,a:{b:'á',a:true},list:['x',2]},canonical='{"a":{"a":true,"b":"á"},"list":["x",2],"z":null}';
 assert.equal((await db.query('select academic_review_canonical($1::jsonb) v',[JSON.stringify(content)])).rows[0].v,canonical);
 const envelope=`{"contenido":${canonical},"entidad":"CREDENCIAL","institucion":"${ids.institution}","origen":"fixture"}`;
 assert.equal((await db.query('select academic_review_fingerprint($1,$2,$3,$4) v',[ids.institution,'CREDENCIAL','fixture',JSON.stringify(content)])).rows[0].v,createHash('sha256').update(envelope).digest('hex'));
}));
test('baseline check writes nothing; baseline creates fingerprints without pending or canonical mutation',()=>scenario(async db=>{
 const before=await snapshot(db);assert.equal((await baseline(db,{check:true})).ready,true);
 assert.equal((await db.query('select count(*)::int n from cortes_revision_academica')).rows[0].n,0);
 const result=await baseline(db);assert.equal(result.aplicado,true);assert.deepEqual(result.cantidades,{ESTUDIANTE:1,CREDENCIAL:1,PROGRAMA:1,SEDE:1,PROGRAMA_SEDE:1});
 const lease=await beginDetection(db);const r=await submit(db,observation(),lease);assert.ok(r.observaciones.every(v=>!v.nueva&&v.id===null));assert.deepEqual(await snapshot(db),before);
}));
test('unknown institutional student/credential abort the entire baseline without inserting a cut',()=>scenario(async db=>{
 const result=await baseline(db,{observations:[observation(),observation({fresh:true})]});assert.equal(result.ready,false);assert.equal(result.desconocidos.length,2);assert.equal((await db.query('select count(*)::int n from cortes_revision_academica')).rows[0].n,0);
}));
test('no detection before baseline; DB lease excludes a second connector and fences old leases',()=>scenario(async db=>{
 await assert.rejects(beginDetection(db),/REVIEW_BASELINE_REQUIRED/);await baseline(db);const lease=await beginDetection(db);
 await assert.rejects(beginDetection(db),/REVIEW_DETECTION_RUNNING/);
 await assert.rejects(submit(db,observation(),{id:ids.admin}),/REVIEW_DETECTION_EXPIRED/);
 await rpc(db,'controlar_deteccion_academica',{p_integracion_id:ids.integration,p_accion:'FINALIZAR',p_deteccion_id:lease.id});
 await assert.rejects(submit(db,observation(),lease),/REVIEW_DETECTION_EXPIRED/);assert.notEqual((await beginDetection(db)).id,lease.id);
}));
test('new student and credential are one pending group; approval is atomic and next detection is unchanged',()=>scenario(async db=>{
 await baseline(db);const before=await snapshot(db),lease=await beginDetection(db),o=observation({fresh:true});const r=await submit(db,o,lease),id=requestId(r);
 assert.equal(r.observaciones.length,1);assert.deepEqual(await snapshot(db),before);
 assert.equal((await db.query('select tipo from solicitudes_revision_academica where id=$1',[id])).rows[0].tipo,'NUEVO_ESTUDIANTE');
 await decision(db,id);const after=await snapshot(db);assert.equal(after.personas_maestra.length,before.personas_maestra.length+1);assert.equal(after.credenciales.length,before.credenciales.length+1);
 assert.ok((await submit(db,o,lease)).observaciones.every(v=>!v.nueva));assert.deepEqual(await snapshot(db),after);
}));
test('new credential for known student remains pending until ADMIN approves',()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation();o.credenciales[0].identificadorOrigen='new-credential';o.credenciales[0].contenido.codigoOrigen='SYNTH-NEW-CREDENTIAL';const r=await submit(db,o,lease),id=requestId(r);
 assert.equal((await db.query('select tipo from solicitudes_revision_academica where id=$1',[id])).rows[0].tipo,'NUEVA_CREDENCIAL');assert.equal((await snapshot(db)).credenciales.length,1);await decision(db,id);assert.equal((await snapshot(db)).credenciales.length,2);
}));
test('legacy content edit is pending; approval adds a version and preserves preexisting identity/history',()=>scenario(async db=>{
 const before=await snapshot(db),{result}=await changed(db);assert.deepEqual(await snapshot(db),before);const id=requestId(result);await decision(db,id);const after=await snapshot(db);
 assert.equal(after.credenciales[0].id,before.credenciales[0].id);assert.equal(after.credencial_versiones.length,2);assert.deepEqual(after.credencial_versiones.find(v=>v.numero_version===1),before.credencial_versiones[0]);
 assert.equal(after.credencial_versiones.find(v=>v.numero_version===2).titulo,'Título sintético modificado');assert.equal(after.credencial_eventos.find(v=>v.tipo_evento==='CORREGIDA').tipo_evento,'CORREGIDA');
}));
for(const state of ['REVOCADA','ANULADA'])test(`${state} is pending before approval, terminal only after approval, never auto-reactivated`,()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation();o.credenciales[0].estado=state;const r=await submit(db,o,lease);
 assert.equal((await snapshot(db)).credenciales[0].estado_actual,'VIGENTE');await decision(db,requestId(r));assert.equal((await snapshot(db)).credenciales[0].estado_actual,state);
 o.credenciales[0].estado='VIGENTE';o.credenciales[0].sourceUpdatedAt='2026-11-09T11:00:00Z';const next=await submit(db,o,lease),id=requestId(next);assert.ok(id);const before=await snapshot(db);await assert.rejects(decision(db,id),/REVIEW_TERMINAL_BLOCKED/);assert.deepEqual(await snapshot(db),before);assert.equal((await db.query('select estado from solicitudes_revision_academica where id=$1',[id])).rows[0].estado,'PENDIENTE');
}));
test('same detection twenty times never duplicates a review',()=>scenario(async db=>{
 const {lease,o,result}=await changed(db);for(let i=0;i<20;i++)assert.ok((await submit(db,o,lease)).observaciones.every(v=>!v.nueva));assert.equal((await db.query('select count(*)::int n from solicitudes_revision_academica')).rows[0].n,1);assert.ok(requestId(result));
}));
test('new source content supersedes pending; stale approval conflicts; corrected rejection can generate a new review',()=>scenario(async db=>{
 const {lease,o,result}=await changed(db),old=requestId(result);o.credenciales[0].contenido.titulo='Nuevo contenido posterior';o.credenciales[0].sourceUpdatedAt='2026-11-09T11:00:00Z';const next=requestId(await submit(db,o,lease));
 assert.equal((await db.query('select estado from solicitudes_revision_academica where id=$1',[old])).rows[0].estado,'SUPERSEDIDA');await assert.rejects(decision(db,old),/REVIEW_STALE/);
 const before=await snapshot(db);await decision(db,next,{action:'RECHAZAR',reason:'Contenido sintético rechazado'});assert.deepEqual(await snapshot(db),before);assert.ok((await submit(db,o,lease)).observaciones.every(v=>!v.nueva));
 o.credenciales[0].contenido.titulo='Contenido institucional corregido';o.credenciales[0].sourceUpdatedAt='2026-11-09T12:00:00Z';assert.ok(requestId(await submit(db,o,lease)));
}));
test('AUDITOR and institution UUID cannot decide; rejection needs a reason; duplicate approval is idempotent',()=>scenario(async db=>{
 const {result}=await changed(db),id=requestId(result);await assert.rejects(decision(db,id,{actor:ids.auditor}),/REVIEW_FORBIDDEN/);await assert.rejects(decision(db,id,{actor:ids.integration}),/REVIEW_FORBIDDEN/);await assert.rejects(decision(db,id,{action:'RECHAZAR',reason:''}),/REVIEW_INVALID_DECISION/);
 await decision(db,id);const after=await snapshot(db);assert.equal((await decision(db,id)).replayed,true);assert.deepEqual(await snapshot(db),after);
}));
test('a failed grouped approval rolls back person, credential, status and audit as one transaction',()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation({fresh:true});o.credenciales[0].contenido.fechaEmision='invalid';const id=requestId(await submit(db,o,lease)),before=await snapshot(db),audits=(await db.query('select count(*)::int n from auditoria')).rows[0].n;
 await assert.rejects(decision(db,id));assert.deepEqual(await snapshot(db),before);assert.equal((await db.query('select estado from solicitudes_revision_academica where id=$1',[id])).rows[0].estado,'PENDIENTE');assert.equal((await db.query('select count(*)::int n from auditoria')).rows[0].n,audits);
}));
test('forged origin identity cannot reassign a known source to another document',()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation();o.persona.numeroDocumento='SYNTH-OTHER';const id=requestId(await submit(db,o,lease)),before=await snapshot(db);await assert.rejects(decision(db,id),/REVIEW_IDENTITY_CHANGE_BLOCKED/);assert.deepEqual(await snapshot(db),before);
}));
test('older source timestamps cannot supersede newer pending content',()=>scenario(async db=>{
 const {lease,o,result}=await changed(db);o.credenciales[0].contenido.titulo='Viejo contenido';o.credenciales[0].sourceUpdatedAt='2026-11-08T10:00:00Z';await assert.rejects(submit(db,o,lease),/REVIEW_SOURCE_STALE/);assert.equal((await db.query('select estado from solicitudes_revision_academica where id=$1',[requestId(result)])).rows[0].estado,'PENDIENTE');
}));
test('browser roles have no review access or RPC execution; service cannot bypass approval or mutate review rows',()=>scenario(async db=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query(`select has_table_privilege($1,'public.solicitudes_revision_academica','select') v`,[role])).rows[0].v,false);
  assert.equal((await db.query(`select has_function_privilege($1,'public.decidir_revision_academica(uuid,uuid,text,text)','execute') v`,[role])).rows[0].v,false);
 }
 await db.exec('set role service_role');
 await assert.rejects(db.query("insert into personas_maestra(tipo_documento,numero_documento,primer_nombre,primer_apellido) values('CC','SYNTH-BYPASS','Test','Test')"),/REVIEW_APPROVAL_REQUIRED/);
 await assert.rejects(db.query("update solicitudes_revision_academica set estado='APROBADA'"),/permission denied/);await db.exec('reset role');
}));
test('another institution gets its own proposals even with equal origin IDs; no cross-institution canonical changes',()=>scenario(async db=>{
 await baseline(db);await baseline(db,{integration:ids.otherIntegration,observations:[],catalog:{programas:[],sedes:[],relaciones:[]}});const lease=await beginDetection(db,ids.otherIntegration),o=observation();const r=await submit(db,o,lease,ids.otherIntegration),id=requestId(r);assert.equal((await db.query('select institucion_id,tipo from solicitudes_revision_academica where id=$1',[id])).rows[0].institucion_id,ids.otherInstitution);assert.equal((await snapshot(db)).persona_fuentes.length,1);
}));

test('baseline fingerprints remain immutable after a correction and retain source timestamps',()=>scenario(async db=>{
 const catalog={programas:[{identificadorOrigen:'program-id',payload:observation().credenciales[0].programa,sourceUpdatedAt:'2026-11-08T12:00:00Z'}],sedes:[],relaciones:[]};
 await baseline(db,{catalog});
 const frozen=(await db.query('select * from huellas_baseline_revision_academica order by entidad_tipo,identificador_origen')).rows;
 assert.equal(frozen.length,3);assert.ok(frozen.every(r=>r.source_updated_at));
 const lease=await beginDetection(db),o=observation();o.credenciales[0].contenido.titulo='Corrección posterior al corte';await decision(db,requestId(await submit(db,o,lease)));
 assert.deepEqual((await db.query('select * from huellas_baseline_revision_academica order by entidad_tipo,identificador_origen')).rows,frozen);
 await assert.rejects(db.exec("update huellas_baseline_revision_academica set fingerprint=repeat('b',64)"));
 await assert.rejects(baseline(db,{check:null}),/REVIEW_INVALID_PAYLOAD/);
}));
test('a known institutional source row cannot be reassigned to another credential code',()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation();o.credenciales[0].contenido.codigoOrigen='SYNTH-REASSIGNED';
 await assert.rejects(submit(db,o,lease),/REVIEW_SOURCE_IDENTITY_CONFLICT/);assert.equal((await db.query('select count(*)::int n from solicitudes_revision_academica')).rows[0].n,0);
}));
test('A to B to A is a new episode; timestamp-only changes are deduplicated',()=>scenario(async db=>{
 const {lease,o,result}=await changed(db);await decision(db,requestId(result));
 o.credenciales[0].sourceUpdatedAt='2026-11-09T11:00:00Z';assert.ok((await submit(db,o,lease)).observaciones.every(r=>!r.nueva));
 o.credenciales[0].contenido.titulo=observation().credenciales[0].contenido.titulo;const id=requestId(await submit(db,o,lease));assert.ok(id);await decision(db,id);
 assert.equal((await snapshot(db)).credencial_versiones.length,3);assert.equal((await snapshot(db)).credenciales[0].version_actual,3);
}));
test('a concurrent approved catalog change invalidates a pending canonical comparison',()=>scenario(async db=>{
 await baseline(db);const lease=await beginDetection(db),o=observation();o.credenciales[0].contenido.codigoOrigen='SYNTH-SECOND';o.credenciales[0].identificadorOrigen='second-row';await decision(db,requestId(await submit(db,o,lease)));
 const first=observation();first.credenciales[0].contenido.titulo='Primera pendiente';const stale=requestId(await submit(db,first,lease));
 o.credenciales[0].programa.nombre='Programa actualizado por decisión';await decision(db,requestId(await submit(db,o,lease)));
 await assert.rejects(decision(db,stale),/REVIEW_CANONICAL_CHANGED/);
 const detail=await rpc(db,'obtener_revision_academica',{p_admin_id:ids.auditor,p_solicitud_id:stale});assert.ok(detail.data.bloqueos.includes('CANONICO_MODIFICADO'));
 const next=requestId(await submit(db,first,lease));assert.notEqual(next,stale);assert.equal((await db.query('select estado from solicitudes_revision_academica where id=$1',[stale])).rows[0].estado,'SUPERSEDIDA');
}));
test('auditor list is bounded, filtered, audited and excludes proposed personal payloads',()=>scenario(async db=>{
 const {result}=await changed(db);const r=await rpc(db,'listar_revisiones_academicas',{p_admin_id:ids.auditor,p_filtros:{page:1,pageSize:1,estado:'PENDIENTE',q:'SYNTH-REVIEW'}});
 assert.equal(r.meta.total,1);assert.equal(r.data[0].id,requestId(result));assert.ok(!JSON.stringify(r).includes('numeroDocumento'));assert.ok(!JSON.stringify(r).includes('payload_propuesto'));
 assert.equal((await rpc(db,'listar_revisiones_academicas',{p_admin_id:ids.admin,p_filtros:{page:2,pageSize:1}})).data.length,0);
 await assert.rejects(rpc(db,'listar_revisiones_academicas',{p_admin_id:ids.admin,p_filtros:{pageSize:101}}),/REVIEW_INVALID_FILTER/);
 assert.equal((await db.query("select count(*)::int n from auditoria where accion='ACADEMIC_REVIEW_READ'")).rows[0].n,2);
}));
test('service role cannot forge a previously approved context or run historical mutation RPCs',()=>scenario(async db=>{
 const {result}=await changed(db),id=requestId(result);await decision(db,id);await db.exec('set role service_role');
 await db.query("select set_config('raes.academic_review_id',$1,false)",[id]);
 await assert.rejects(db.query("update credenciales set version_actual=999"),/REVIEW_APPROVAL_REQUIRED/);
 for(const name of ['registrar_credencial_inicial','corregir_credencial','transicionar_estado_credencial'])assert.equal((await db.query("select bool_or(has_function_privilege('service_role',p.oid,'execute')) v from pg_proc p where proname=$1",[name])).rows[0].v,false);
 await db.exec('reset role');
}));

test('approving a credential does not rewrite unchanged catalog rows or their timestamps',()=>scenario(async db=>{
 const before={};for(const table of ['programas','sedes','programa_sede'])before[table]=(await db.query(`select to_jsonb(t) data from ${table} t order by id`)).rows;
 const {result}=await changed(db);await decision(db,requestId(result));
 for(const table of Object.keys(before))assert.deepEqual((await db.query(`select to_jsonb(t) data from ${table} t order by id`)).rows,before[table]);
}));
