import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {parse} from 'dotenv';
import {createClient} from '@supabase/supabase-js';

// Postcheck of an already approved synthetic fixture. No account creation,
// passwords or new decisions. The decision replay is verified in ROLLBACK with
// the same server role as the API; it is not presented as a citizen/admin login.
const root=resolve('../..'),manifest=JSON.parse(readFileSync(resolve(root,'supabase/fixtures/academic-review/manifest.json'))),prior=JSON.parse(readFileSync(resolve(root,'docs/reports/evidence/academic-review-live-resume-attempt.json'))),first=JSON.parse(readFileSync(resolve(root,'docs/reports/evidence/academic-review-live-first-attempt.json')));
const env=parse(readFileSync('.env.local')),credEnv=parse(readFileSync('../credenly-api/.env.local')),sourceEnv=parse(readFileSync('../connector-poli/.env.local'));
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}};
const db=createClient(env.RAES_SUPABASE_URL,env.RAES_SUPABASE_SERVICE_ROLE_KEY,options),citizens=createClient(credEnv.CREDENLY_SUPABASE_URL,credEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,options),source=createClient(sourceEnv.POLI_SUPABASE_URL,sourceEnv.POLI_SUPABASE_SERVICE_ROLE_KEY,options);
function check(ok){assert.ok(ok,'Postcheck assertion failed; private data omitted');}
let token=execFileSync('security',['find-generic-password','-a','proyecto-gobernacion','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(token.startsWith('go-keyring-base64:'))token=Buffer.from(token.slice(18),'base64').toString();
async function sql(ref,query,readOnly=true){const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:readOnly}),signal:AbortSignal.timeout(30000)});check(r.ok);return r.json();}
const tables=['instituciones','sedes','programas','programa_sede','personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api','perfiles_admin'];
const digestQuery='select jsonb_build_object('+tables.map(t=>`'${t}',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text,'UTF8')),'hex') from public.${t} t)`).join(',')+') as hashes';
async function counts(){const out={};for(const table of ['personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api']){const r=await db.from(table).select('id',{count:'exact',head:true});check(!r.error);out[table]=r.count;}return out;}
async function main(){
 check(new URL(env.RAES_SUPABASE_URL).hostname==='askqizcwemmydwcgrewp.supabase.co'&&new URL(credEnv.CREDENLY_SUPABASE_URL).hostname==='xvzylegwuxmxqcgdjjrq.supabase.co'&&new URL(sourceEnv.POLI_SUPABASE_URL).hostname===manifest.sourceProject+'.supabase.co');
 const approved=prior.stages.find(s=>s.name==='NEXT_GET_RETURNS_APPROVED_B');check(approved?.httpStatus===200&&approved.version===2&&approved.source==='RAES'&&approved.persistedByCredenly===false&&prior.cleanup?.authAbsent&&prior.preexistingAcademicAndCitizenRowsUnchanged);
 const beforeCounts=await counts(),beforeHashes=await sql('askqizcwemmydwcgrewp',digestQuery);
 const result=await db.from('credenciales').select('id,codigo_raes,version_actual,estado_actual,persona_id').eq('id',approved.credentialId).single();check(!result.error&&result.data.version_actual===2&&result.data.estado_actual==='VIGENTE');
 const version=await db.from('credencial_versiones').select('titulo').eq('credencial_id',approved.credentialId).eq('numero_version',2).single();check(!version.error&&version.data.titulo===manifest.titleB);
 const sourceRow=await source.from('credenciales').select('id,codigo,titulo').eq('id',manifest.ids.credential).single();check(!sourceRow.error&&sourceRow.data.codigo===manifest.credentialCode&&sourceRow.data.titulo===manifest.titleB);
 const out=execFileSync('pnpm',['--filter','@raes/connector-poli','detect','--','--credential-code='+manifest.credentialCode],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
 const detection=out.split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(v=>v?.operation==='DETECT_AND_SUBMIT');check(detection?.canonicalWrites===0&&detection.proposalsCreated===0&&detection.observationsUnchanged===2);
 check(/^[0-9a-f-]{36}$/.test(approved.requestId));
 const replay=(await sql('askqizcwemmydwcgrewp',`begin;set local role service_role;select public.decidir_revision_academica('${approved.requestId}','a17656ca-1950-4ec9-af47-2514178a65ea','APROBAR','Prueba sintética controlada autorizada por el propietario') as result;rollback;`,false))[0].result;
 check(replay.replayed===true&&replay.estado==='APROBADA'&&replay.recursoRaesId===approved.credentialId);
 assert.deepEqual(await counts(),beforeCounts);assert.deepEqual(await sql('askqizcwemmydwcgrewp',digestQuery),beforeHashes);
 const requests=await db.from('solicitudes_revision_academica').select('id,tipo,estado').eq('persona_identificador_origen',manifest.ids.student);check(!requests.error&&requests.data.length===2&&requests.data.every(r=>r.estado==='APROBADA'));
 const temporaryIds=[first.temporaryId,prior.temporaryId];check(temporaryIds.every(id=>/^[0-9a-f-]{36}$/.test(id)));
 const absent=[];for(const id of temporaryIds){const r=await citizens.auth.admin.getUserById(id);check(r.error?.status===404);for(const table of ['perfiles','verificaciones_identidad','vinculaciones_raes','comparticiones']){const r=await citizens.from(table).select('id',{count:'exact',head:true}).eq(table==='perfiles'?'id':'usuario_id',id);check(!r.error&&r.count===0);}absent.push(id);}
 const residues=(await sql('xvzylegwuxmxqcgdjjrq',`select jsonb_build_object('users',(select count(*) from auth.users where id in ('${temporaryIds.join("','")}')),'identities',(select count(*) from auth.identities where user_id in ('${temporaryIds.join("','")}')),'sessions',(select count(*) from auth.sessions where user_id in ('${temporaryIds.join("','")}')),'profiles',(select count(*) from perfiles),'verifications',(select count(*) from verificaciones_identidad),'links',(select count(*) from vinculaciones_raes),'shares',(select count(*) from comparticiones),'shareAccesses',(select count(*) from accesos_compartidos),'authUsers',(select count(*) from auth.users)) as result`))[0].result;
 check(residues.users===0&&residues.identities===0&&residues.sessions===0&&residues.profiles===1&&residues.verifications===1&&residues.links===1&&residues.shares===5&&residues.shareAccesses===9&&residues.authUsers===4);
 const evidence={checkedAt:new Date().toISOString(),result:'PASS',realCitizenHttpProof:'academic-review-live-resume-attempt.json',detection,replay:{transport:'Management SQL, service_role, ROLLBACK (not HTTP)',...replay},canonicalCounts:beforeCounts,allElevenCanonicalTableHashesUnchanged:true,requests:requests.data,temporaryUsersConfirmedAbsent:absent,residues,credential:{id:result.data.id,code:result.data.codigo_raes,version:2,title:manifest.titleB},citizenSource:'RAES',persistedByCredenly:false,academicWritesCredenly:0};
 writeFileSync('/tmp/academic-review-live-postcheck.json',JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(evidence));
}
main().catch(()=>{console.error('Postcheck did not pass; private diagnostics omitted');process.exitCode=1;});
