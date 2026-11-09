import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {createHash,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {parse} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {renderSyntheticReviewDocument} from './lib/synthetic-review-document.mjs';

// Explicitly authorized, permanent synthetic fixture + temporary citizen account.
// No password in args/env/files; no production fixture exceptions in application.
const root=resolve('../..'),manifest=JSON.parse(readFileSync(resolve(root,'supabase/fixtures/academic-review/manifest.json'),'utf8'));
const env=parse(readFileSync('.env.local','utf8')),credEnv=parse(readFileSync('../credenly-api/.env.local','utf8'));
const sourceEnv=parse(readFileSync('../connector-poli/.env.local','utf8'));
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const db=createClient(env.RAES_SUPABASE_URL,env.RAES_SUPABASE_SERVICE_ROLE_KEY,options),citizens=createClient(credEnv.CREDENLY_SUPABASE_URL,credEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,options),adminSession=createClient(env.RAES_SUPABASE_URL,env.RAES_SUPABASE_SERVICE_ROLE_KEY,options),citizenSession=createClient(credEnv.CREDENLY_SUPABASE_URL,credEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,options);
const evidence={startedAt:new Date().toISOString(),fixture:manifest,stages:[],academicWritesCredenly:0};let originals;let stage='PRECHECK',temporaryId=null,adminToken,citizenToken,password;
const args=process.argv.slice(2);
if(args.some(arg=>!['--check','--resume'].includes(arg))||new Set(args).size!==args.length)throw Error('Usage: verify-academic-review-live [--resume] [--check]');
const checkOnly=args.includes('--check'),resume=args.includes('--resume');
let resumedFixture;
const email='review-20261109@fixture.invalid';
const source=createClient(sourceEnv.POLI_SUPABASE_URL,sourceEnv.POLI_SUPABASE_SERVICE_ROLE_KEY,options);
async function state(client,tables){const result={};for(const table of tables){const rows=[];for(let offset=0;;offset+=1000){const r=await client.from(table).select('*').order('id').range(offset,offset+999);check(!r.error&&r.data);rows.push(...r.data);if(r.data.length<1000)break;check(offset<10000);}result[table]=rows;}return result;}
function rowHash(row){return createHash('sha256').update(JSON.stringify(row)).digest('hex');}
async function unchanged(client,before){const after=await state(client,Object.keys(before));for(const table of Object.keys(before))for(const row of before[table])check(after[table].some(current=>current.id===row.id&&rowHash(current)===rowHash(row)));}

function check(ok){if(!ok)throw Error('LIVE_CHECK_FAILED');}
function save(){writeFileSync('/tmp/academic-review-live-result.json',JSON.stringify(evidence,null,2)+'\n',{mode:0o600});}
function done(name,data={}){evidence.stages.push({name,...data});save();console.log(name);}
async function sql(query){let token=execFileSync('security',['find-generic-password','-a','instituciones','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(token.startsWith('go-keyring-base64:'))token=Buffer.from(token.slice(18),'base64').toString();const r=await fetch('https://api.supabase.com/v1/projects/'+manifest.sourceProject+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false}),signal:AbortSignal.timeout(30000)});check(r.ok);return r.json();}
async function request(base,path,token,{method='GET',body}={}){const r=await fetch(base+'/api/v1/'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const data=await r.json();check(r.ok);return {body:data,status:r.status,cache:r.headers.get('cache-control')};}
async function detect(){const out=execFileSync('pnpm',['--filter','@raes/connector-poli','detect','--','--credential-code='+manifest.credentialCode],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});const summary=out.split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(v=>v?.operation==='DETECT_AND_SUBMIT');check(summary?.canonicalWrites===0);return summary;}
async function pending(type){const result=await db.from('solicitudes_revision_academica').select('id,estado,tipo').eq('persona_identificador_origen',manifest.ids.student).eq('tipo',type).eq('estado','PENDIENTE');check(!result.error&&result.data?.length===1);return result.data[0].id;}
async function approve(id){return (await request('http://localhost:3001',`admin/academic-reviews/${id}/approve`,adminToken,{method:'POST',body:{motivo:'Prueba sintética controlada autorizada por el propietario'}})).body.data;}
async function live(){const result=await request('http://localhost:3002','credentials',citizenToken);check(result.status===200&&result.cache==='private, no-store'&&result.body.source==='RAES'&&result.body.persistedByCredenly===false&&result.body.data.length===1);return result.body.data[0];}
async function counts(){const tables=['personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api'];return Object.fromEntries(await Promise.all(tables.map(async table=>{const r=await db.from(table).select('id',{count:'exact',head:true});check(!r.error);return [table,r.count];})));}
async function main(){
 check((checkOnly||process.stdin.isTTY)&&new URL(env.RAES_SUPABASE_URL).hostname==='askqizcwemmydwcgrewp.supabase.co'&&new URL(credEnv.CREDENLY_SUPABASE_URL).hostname==='xvzylegwuxmxqcgdjjrq.supabase.co'&&new URL(sourceEnv.POLI_SUPABASE_URL).hostname===manifest.sourceProject+'.supabase.co');
 check((await db.from('cortes_revision_academica').select('id',{count:'exact',head:true})).count===2);
 const collision=await db.from('persona_fuentes').select('id').eq('identificador_origen',manifest.ids.student);check(!collision.error);
 if(!resume)check(collision.data.length===0);
 else {
  const prior=JSON.parse(readFileSync(resolve(root,'docs/reports/evidence/academic-review-live-first-attempt.json'),'utf8'));
  check(prior.failedStage==='DOCUMENT_OCR'&&prior.cleanup?.authAbsent&&prior.preexistingAcademicAndCitizenRowsUnchanged&&JSON.stringify(prior.fixture)===JSON.stringify(manifest));
  const approved=prior.stages.find(s=>s.name==='NEW_GROUP_APPROVED');check(approved&&collision.data.length===1);
  const request=await db.from('solicitudes_revision_academica').select('id,estado,tipo,recurso_raes_id,institucion_id,persona_identificador_origen').eq('id',approved.requestId).single();
  check(!request.error&&request.data.estado==='APROBADA'&&request.data.tipo==='NUEVO_ESTUDIANTE'&&request.data.recurso_raes_id===approved.personId&&request.data.persona_identificador_origen===manifest.ids.student);
  const canonical=await db.from('credenciales').select('id,codigo_raes,estado_actual,version_actual,persona_id').eq('institucion_id',request.data.institucion_id).eq('codigo_origen',manifest.credentialCode).single();
  check(!canonical.error&&canonical.data.persona_id===approved.personId&&canonical.data.estado_actual==='VIGENTE'&&canonical.data.version_actual===1);
  const version=await db.from('credencial_versiones').select('titulo').eq('credencial_id',canonical.data.id).eq('numero_version',1).single();check(!version.error&&version.data.titulo===manifest.titleA);
  resumedFixture={personId:approved.personId,requestId:approved.requestId,credentialId:canonical.data.id};
  evidence.firstAttempt={startedAt:prior.startedAt,before:prior.before,incorporation:approved,cleanup:prior.cleanup};
 }
 for(let page=1;;page++){const r=await citizens.auth.admin.listUsers({page,perPage:200});check(!r.error);check(!r.data.users.some(u=>u.email?.toLowerCase()===email));if(r.data.users.length<200)break;}
 evidence.before=await counts();
 originals={raes:await state(db,['instituciones','programas','sedes','programa_sede','personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api','perfiles_admin']),source:await state(source,['institucion','programas','sedes','programa_sede','estudiantes','matriculas','credenciales']),citizen:await state(citizens,['perfiles','verificaciones_identidad','vinculaciones_raes','comparticiones','accesos_compartidos'])};
 if(resume){
  const own=originals.source.credenciales.find(c=>c.id===manifest.ids.credential),student=originals.source.estudiantes.find(p=>p.id===manifest.ids.student),enrollment=originals.source.matriculas.find(m=>m.id===manifest.ids.enrollment);
  check(own?.codigo===manifest.credentialCode&&own.titulo===manifest.titleA&&own.estudiante_id===manifest.ids.student&&own.matricula_id===manifest.ids.enrollment&&student?.numero_documento===manifest.document&&student.tipo_documento==='CC'&&enrollment?.estudiante_id===manifest.ids.student);
  // Only the explicitly authorized fixture credential changes A→B in this resume.
  originals.source.credenciales=originals.source.credenciales.filter(c=>c.id!==manifest.ids.credential);
  originals.raes.credenciales=originals.raes.credenciales.filter(c=>c.id!==resumedFixture.credentialId);
 }
 const program=originals.source.programas.find(p=>p.codigo_interno==='SIM-POLI-INF'),campus=originals.source.sedes.find(c=>c.codigo==='RIO');check(program&&campus);
 const canonicalProgram=originals.raes.programas.find(p=>p.codigo_origen===program.codigo_interno),canonicalCampus=originals.raes.sedes.find(c=>c.codigo_origen===campus.codigo);check(canonicalProgram&&canonicalCampus);
 for(const name of ['codigo_snies','nombre','nivel_formacion','modalidad','facultad','estado'])check(canonicalProgram[name]===program[name]);
 for(const name of ['nombre','departamento','municipio','direccion','estado'])check(canonicalCampus[name]===campus[name]);
 const relation=originals.source.programa_sede.find(r=>r.programa_id===program.id&&r.sede_id===campus.id),canonicalRelation=originals.raes.programa_sede.find(r=>r.programa_id===canonicalProgram.id&&r.sede_id===canonicalCampus.id);check(relation&&canonicalRelation);for(const name of ['jornada','modalidad','estado'])check(relation[name]===canonicalRelation[name]);
 if(checkOnly){done('PRECHECK_PASS_NO_WRITES');return;}
 stage='ADMIN_PASSWORD_INPUT';const hidden=new Writable({write(_c,_e,cb){cb();}}),terminal=createInterface({input:process.stdin,output:hidden,terminal:true});
 try{process.stdout.write('Contraseña ACTUAL de admin@raes.com (oculta; no se cambia): ');password=await terminal.question('');process.stdout.write('\n');}finally{terminal.close();hidden.end();}
 stage='ADMIN_LOGIN';const auth=await adminSession.auth.signInWithPassword({email:'admin@raes.com',password});password=undefined;if(auth.error)evidence.adminLoginError={status:auth.error.status,code:auth.error.code};check(!auth.error&&auth.data.user.id==='a17656ca-1950-4ec9-af47-2514178a65ea'&&auth.data.session);adminToken=auth.data.session.access_token;
 const me=await request('http://localhost:3001','admin/me',adminToken);check(me.body.data.rol==='SUPERADMIN'&&me.body.data.estado==='ACTIVO');done('ADMIN_AUTHENTICATED');
 if(!resume){
 stage='SOURCE_FIXTURE';await sql(readFileSync(resolve(root,'supabase/fixtures/academic-review/poli.sql'),'utf8'));done('THREE_SOURCE_ROWS_CREATED');
 stage='DETECTION_NEW';const first=await detect();check(first.proposalsCreated===1);const incorporation=await pending('NUEVO_ESTUDIANTE');check(JSON.stringify(await counts())===JSON.stringify(evidence.before));done('NEW_GROUP_PENDING_CANONICAL_UNCHANGED',{requestId:incorporation,detection:first});
 stage='APPROVAL_NEW';const applied=await approve(incorporation);check(applied.estado==='APROBADA'&&!applied.replayed);const personId=applied.recursoRaesId;done('NEW_GROUP_APPROVED',{requestId:incorporation,personId});
 }else done('EXISTING_APPROVED_FIXTURE_VERIFIED',resumedFixture);
 stage='CITIZEN_ACCOUNT';const temporaryPassword=randomBytes(40).toString('base64url');const created=await citizens.auth.admin.createUser({email,password:temporaryPassword,email_confirm:true});check(!created.error&&created.data.user);temporaryId=created.data.user.id;evidence.temporaryId=temporaryId;save();
 const login=await citizenSession.auth.signInWithPassword({email,password:temporaryPassword});check(!login.error&&login.data.session&&login.data.user.id===temporaryId);citizenToken=login.data.session.access_token;
 await request('http://localhost:3002','profile',citizenToken,{method:'PUT',body:{nombres:'Sintetica',apellidos:'Revision'}});
 stage='DOCUMENT_OCR';const image=await renderSyntheticReviewDocument(manifest.document);
 const form=new FormData();form.set('documento',new Blob([image],{type:'image/png'}),'synthetic-review.png');const r=await fetch('http://localhost:3002/api/v1/identity-verifications',{method:'POST',headers:{Authorization:'Bearer '+citizenToken},body:form,signal:AbortSignal.timeout(120000)});const verification=await r.json();evidence.ocr={httpStatus:r.status,state:verification.data?.estado,confidence:verification.data?.confianzaOcr,expectedDocumentMatched:verification.data?.numeroDocumento===manifest.document};save();check(r.status===201&&verification.data.estado==='APROBADA'&&verification.data.numeroDocumento===manifest.document);
 await request('http://localhost:3002','raes/link',citizenToken,{method:'POST',body:{verificacionIdentidadId:verification.data.id}});done('TEMPORARY_CITIZEN_LINKED_VIA_REAL_OCR',{verificationId:verification.data.id});
 stage='CITIZEN_A';const a=await live();check(a.version.titulo===manifest.titleA&&a.versionActual===1);done('CITIZEN_A',{credentialId:a.id,code:a.codigoRaes,institutionId:a.institucion.id,httpStatus:200});
 stage='SOURCE_CHANGE_B';await sql(`begin;do $$begin if (select count(*) from public.credenciales where id='${manifest.ids.credential}' and codigo='${manifest.credentialCode}' and titulo='${manifest.titleA}')<>1 then raise exception 'FIXTURE_STATE_CHANGED';end if;update public.credenciales set titulo='${manifest.titleB}' where id='${manifest.ids.credential}';end $$;commit;`);
 const second=await detect();check(second.proposalsCreated===1);const correction=await pending('ACTUALIZACION_CREDENCIAL');check((await live()).version.titulo===manifest.titleA);done('B_PENDING_CITIZEN_STILL_A',{requestId:correction,detection:second});
 stage='APPROVAL_B';await approve(correction);const b=await live();check(b.id===a.id&&b.version.titulo===manifest.titleB&&b.versionActual===2);done('NEXT_GET_RETURNS_APPROVED_B',{requestId:correction,credentialId:b.id,httpStatus:200,version:2,source:'RAES',persistedByCredenly:false});
 stage='IDEMPOTENCE_COUNTS_BEFORE';const stable=await counts();
 stage='IDEMPOTENCE_DETECTION';const repeat=await detect();evidence.idempotenceDetection=repeat;save();check(repeat.proposalsCreated===0);
 stage='IDEMPOTENCE_REPLAY';const replay=await approve(correction);evidence.idempotenceReplay=replay;save();check(replay.replayed===true);
 stage='IDEMPOTENCE_COUNTS_AFTER';check(JSON.stringify(await counts())===JSON.stringify(stable));done('REPEATED_DETECTION_AND_APPROVAL_IDEMPOTENT',{detection:repeat});
 evidence.after=await counts();evidence.result='PASS';evidence.finishedAt=new Date().toISOString();
}
async function cleanup(){
 password=undefined;
 const citizenSignout=await citizenSession.auth.signOut({scope:'local'});check(!citizenSignout.error);citizenToken=undefined;
 const adminSignout=await adminSession.auth.signOut({scope:'local'});check(!adminSignout.error);adminToken=undefined;
 if(temporaryId){const r=await citizens.auth.admin.deleteUser(temporaryId);check(!r.error);const account=await citizens.auth.admin.getUserById(temporaryId);check(account.error?.status===404);
  const remaining={};for(const table of ['perfiles','verificaciones_identidad','vinculaciones_raes','comparticiones']){const r=await citizens.from(table).select('id',{count:'exact',head:true}).eq(table==='perfiles'?'id':'usuario_id',temporaryId);check(!r.error&&r.count===0);remaining[table]=r.count;}
  await unchanged(db,originals.raes);await unchanged(source,originals.source);await unchanged(citizens,originals.citizen);evidence.preexistingAcademicAndCitizenRowsUnchanged=true;
  evidence.cleanup={authAbsent:true,citizenRows:remaining,sessionsClosed:true};done('TEMPORARY_ACCOUNT_AND_CITIZEN_ROWS_REMOVED');
 }
}
try{await main();}catch(error){evidence.diagnostic={...(Number.isInteger(error?.status)?{status:error.status}:{}),...(typeof error?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(error.code)?{code:error.code}:{})};evidence.result='FAIL';evidence.failedStage=stage;console.error('La prueba se detuvo en la etapa '+stage+'; no se imprimen detalles privados.');process.exitCode=1;}finally{try{await cleanup();}catch{evidence.cleanupFailed=true;console.error('Limpieza no confirmada. No se fuerzan eliminaciones.');process.exitCode=1;}save();}
if(!checkOnly&&evidence.result==='PASS'&&!evidence.cleanupFailed)console.log('Prueba completa correcta; cuenta temporal eliminada.');
