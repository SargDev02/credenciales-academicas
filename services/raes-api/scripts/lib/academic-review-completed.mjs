import assert from 'node:assert/strict';
import {detectFixture,verifyIdempotence,safeDiagnostic,OperatorError} from './academic-review-idempotence.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {parse} from 'dotenv';
import {createClient} from '@supabase/supabase-js';

// Postcheck of an already approved synthetic fixture. No account creation,
// passwords or new decisions. The decision replay is verified in ROLLBACK with
// the same server role as the API; it is not presented as a citizen/admin login.
export async function verifyCompletedReview({outputPath,mode='postcheck'}){
let phase='COMPLETED_PRECHECK';const trace=[];
try{
const root=resolve('../..'),manifest=JSON.parse(readFileSync(resolve(root,'supabase/fixtures/academic-review/manifest.json'))),prior=JSON.parse(readFileSync(resolve(root,'docs/reports/evidence/academic-review-live-resume-attempt.json'))),first=JSON.parse(readFileSync(resolve(root,'docs/reports/evidence/academic-review-live-first-attempt.json')));
const env=parse(readFileSync('.env.local')),credEnv=parse(readFileSync('../credenly-api/.env.local')),sourceEnv=parse(readFileSync('../connector-poli/.env.local'));
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}};
const db=createClient(env.RAES_SUPABASE_URL,env.RAES_SUPABASE_SERVICE_ROLE_KEY,options),citizens=createClient(credEnv.CREDENLY_SUPABASE_URL,credEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,options),source=createClient(sourceEnv.POLI_SUPABASE_URL,sourceEnv.POLI_SUPABASE_SERVICE_ROLE_KEY,options);
function check(ok){assert.ok(ok,'Postcheck assertion failed; private data omitted');}
let token=execFileSync('security',['find-generic-password','-a','proyecto-gobernacion','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(token.startsWith('go-keyring-base64:'))token=Buffer.from(token.slice(18),'base64').toString();
async function sql(ref,query,readOnly=true){const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:readOnly}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new OperatorError('MANAGEMENT_SQL_HTTP_ERROR',{httpStatus:r.status});return r.json();}
const tables=['instituciones','sedes','programas','programa_sede','personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api','perfiles_admin'];
const digestQuery='select jsonb_build_object('+tables.map(t=>`'${t}',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text,'UTF8')),'hex') from public.${t} t)`).join(',')+') as hashes';
async function counts(){const out={};for(const table of ['personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api']){const r=await db.from(table).select('id',{count:'exact',head:true});if(r.error)throw new OperatorError('COUNTER_READ_FAILED',{table,httpStatus:r.status});out[table]=r.count;}return out;}

 check(new URL(env.RAES_SUPABASE_URL).hostname==='askqizcwemmydwcgrewp.supabase.co'&&new URL(credEnv.CREDENLY_SUPABASE_URL).hostname==='xvzylegwuxmxqcgdjjrq.supabase.co'&&new URL(sourceEnv.POLI_SUPABASE_URL).hostname===manifest.sourceProject+'.supabase.co');
 const approved=prior.stages.find(s=>s.name==='NEXT_GET_RETURNS_APPROVED_B');check(approved?.httpStatus===200&&approved.version===2&&approved.source==='RAES'&&approved.persistedByCredenly===false&&prior.cleanup?.authAbsent&&prior.preexistingAcademicAndCitizenRowsUnchanged);
 const citizenTables=['perfiles','perfiles_admin','verificaciones_identidad','vinculaciones_raes','comparticiones','accesos_compartidos'];
 const citizenDigest='select jsonb_build_object('+citizenTables.map(t=>`'${t}',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text,'UTF8')),'hex') from public.${t} t)`).join(',')+') as hashes';
 // Identity/profile fingerprints exclude password, token and secret fields.
 const authDigest=ids=>`select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'confirmed',email_confirmed_at,'updated',updated_at) order by id),'[]')::text,'UTF8')),'hex') as fingerprint from auth.users where id in ('${ids.join("','")}')`;
 const raesAuthQuery=authDigest(['a17656ca-1950-4ec9-af47-2514178a65ea']),credAuthQuery=authDigest(['0b0c1230-994a-4940-9c89-f330975ac9d6','bf79e684-6004-49f2-9ad3-b0ab6105b76f']);
 const beforeCounts=await counts(),beforeHashes=await sql('askqizcwemmydwcgrewp',digestQuery);
 const beforeCitizen=await sql('xvzylegwuxmxqcgdjjrq',citizenDigest),beforeRaesAuth=await sql('askqizcwemmydwcgrewp',raesAuthQuery),beforeCredAuth=await sql('xvzylegwuxmxqcgdjjrq',credAuthQuery);
 const pendingBefore=await db.from('solicitudes_revision_academica').select('id',{head:true,count:'exact'}).eq('estado','PENDIENTE');check(!pendingBefore.error&&pendingBefore.count===0);
 const result=await db.from('credenciales').select('id,codigo_raes,version_actual,estado_actual,persona_id').eq('id',approved.credentialId).single();check(!result.error&&result.data.version_actual===2&&result.data.estado_actual==='VIGENTE');
 const version=await db.from('credencial_versiones').select('titulo').eq('credencial_id',approved.credentialId).eq('numero_version',2).single();check(!version.error&&version.data.titulo===manifest.titleB);
 const sourceRow=await source.from('credenciales').select('id,codigo,titulo').eq('id',manifest.ids.credential).single();check(!sourceRow.error&&sourceRow.data.codigo===manifest.credentialCode&&sourceRow.data.titulo===manifest.titleB);
 check(/^[0-9a-f-]{36}$/.test(approved.requestId));
 const verified=await verifyIdempotence({counts,
  detect:()=>{const summary=detectFixture({root,credentialCode:manifest.credentialCode});if(summary.observationsUnchanged!==2)throw new OperatorError('COMPLETED_OBSERVATIONS_UNEXPECTED');return summary;},
  replay:async()=>{const value=(await sql('askqizcwemmydwcgrewp',`begin;set local role service_role;select public.decidir_revision_academica('${approved.requestId}','a17656ca-1950-4ec9-af47-2514178a65ea','APROBAR','Prueba sintética controlada autorizada por el propietario') as result;rollback;`,false))[0].result;return value;},
  onStage:name=>{phase=name;},record:(name,data)=>trace.push({name,data})});
 const {detection,replay}=verified;
 phase='COMPLETED_INVARIANTS';
 check(replay.replayed===true&&replay.estado==='APROBADA'&&replay.recursoRaesId===approved.credentialId);
 assert.deepEqual(await counts(),beforeCounts);assert.deepEqual(await sql('askqizcwemmydwcgrewp',digestQuery),beforeHashes);
 const requests=await db.from('solicitudes_revision_academica').select('id,tipo,estado').eq('persona_identificador_origen',manifest.ids.student);check(!requests.error&&requests.data.length===2&&requests.data.every(r=>r.estado==='APROBADA'));
 const pendingAfter=await db.from('solicitudes_revision_academica').select('id',{head:true,count:'exact'}).eq('estado','PENDIENTE');check(!pendingAfter.error&&pendingAfter.count===0);
 const profiles=await citizens.from('perfiles').select('id');check(!profiles.error&&profiles.data.length===1&&profiles.data[0].id==='0b0c1230-994a-4940-9c89-f330975ac9d6');
 assert.deepEqual(await sql('xvzylegwuxmxqcgdjjrq',citizenDigest),beforeCitizen);
 assert.deepEqual(await sql('askqizcwemmydwcgrewp',raesAuthQuery),beforeRaesAuth);
 assert.deepEqual(await sql('xvzylegwuxmxqcgdjjrq',credAuthQuery),beforeCredAuth);
 const temporaryIds=[first.temporaryId,prior.temporaryId];check(temporaryIds.every(id=>/^[0-9a-f-]{36}$/.test(id)));
 const absent=[];for(const id of temporaryIds){const r=await citizens.auth.admin.getUserById(id);check(r.error?.status===404);for(const table of ['perfiles','verificaciones_identidad','vinculaciones_raes','comparticiones']){const r=await citizens.from(table).select('id',{count:'exact',head:true}).eq(table==='perfiles'?'id':'usuario_id',id);check(!r.error&&r.count===0);}absent.push(id);}
 const residues=(await sql('xvzylegwuxmxqcgdjjrq',`select jsonb_build_object('users',(select count(*) from auth.users where id in ('${temporaryIds.join("','")}')),'identities',(select count(*) from auth.identities where user_id in ('${temporaryIds.join("','")}')),'sessions',(select count(*) from auth.sessions where user_id in ('${temporaryIds.join("','")}')),'profiles',(select count(*) from perfiles),'verifications',(select count(*) from verificaciones_identidad),'links',(select count(*) from vinculaciones_raes),'shares',(select count(*) from comparticiones),'shareAccesses',(select count(*) from accesos_compartidos),'authUsers',(select count(*) from auth.users)) as result`))[0].result;
 check(residues.users===0&&residues.identities===0&&residues.sessions===0&&residues.profiles===1&&residues.verifications===1&&residues.links===1&&residues.shares===5&&residues.shareAccesses===9&&residues.authUsers===4);
 const evidence={checkedAt:new Date().toISOString(),mode,result:'PASS',trace,realCitizenHttpProof:'academic-review-live-resume-attempt.json',detection,replay:{transport:'Management SQL, service_role, ROLLBACK (not HTTP)',...replay},canonicalCounts:beforeCounts,allElevenCanonicalTableHashesUnchanged:true,citizenAndAdminProfilesUnchanged:true,existingAuthIdentityFieldsUnchanged:true,sergioCitizenProfileAbsent:true,unexpectedPendingBefore:0,unexpectedPendingAfter:0,requests:requests.data,temporaryUsersConfirmedAbsent:absent,residues,credential:{id:result.data.id,code:result.data.codigo_raes,version:2,title:manifest.titleB},citizenSource:'RAES',persistedByCredenly:false,academicWritesCredenly:0};
 writeFileSync(outputPath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600,flag:'wx'});return evidence;
}catch(error){const evidence={checkedAt:new Date().toISOString(),mode,result:'FAIL',diagnostic:error.operatorDiagnostic??safeDiagnostic(error,phase),trace};writeFileSync(outputPath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600,flag:'wx'});throw Object.assign(error,{operatorDiagnostic:evidence.diagnostic});}
}
