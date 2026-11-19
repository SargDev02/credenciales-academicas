import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:https';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import { RaesClient, detect } from '../../packages/connector-core/src/index.ts';
import {fixture,ids,baseline,observation,rpc} from '../../scripts/lib/academic-review-fixture.mjs';

// Actual PostgreSQL functions and built Next applications; only Supabase's
// transport/Auth are local substitutes. No environment files or remote clients.
export async function startReviewFixture(){
 const db=await fixture();await baseline(db);
 await db.query("insert into scopes(codigo,descripcion) values('credentials:read','Local fixture') on conflict do nothing");
 const root=resolve(process.cwd()),base='http://localhost:3340',raes='http://localhost:3341',credenly='http://localhost:3342',upstream='https://localhost:3543';
 const scratch=mkdtempSync(join(tmpdir(),'academic-review-local-')),key=join(scratch,'tls.key'),cert=join(scratch,'tls.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
 const password=randomBytes(32).toString('base64url'),signingKey=randomBytes(32),secret='raes_sk_'+randomBytes(32).toString('base64url'),clientId='raes_cli_local_review',clientUuid='00000000-0000-4000-8000-000000000401',citizenId='00000000-0000-4000-8000-000000000501',now=new Date().toISOString();
 await db.query("update integraciones_institucionales set client_id='raes_cli_local_institution' where id=$1",[ids.integration]);
 await db.query("insert into integracion_secretos(integracion_id,key_prefix,secret_hash) values($1,$2,$3)",[ids.integration,secret.slice(0,20),createHash('sha256').update(secret).digest('hex')]);
 await db.query("insert into clientes_api(id,nombre,tipo_cliente,client_id) values($1,'Credenly local','CREDENLY',$2)",[clientUuid,clientId]);
 await db.query("insert into cliente_api_secretos(cliente_api_id,key_prefix,secret_hash) values($1,$2,$3)",[clientUuid,secret.slice(0,20),createHash('sha256').update(secret).digest('hex')]);
 await db.query("insert into cliente_api_scopes(cliente_api_id,scope_id) select $1,id from scopes where codigo in ('persons:resolve','credentials:read')",[clientUuid]);
 const master=(await db.query('select id from personas_maestra')).rows[0].id;
 const users=[ids.admin,ids.auditor,citizenId].map((id,i)=>({id,email:['admin','auditor','citizen'][i]+'@review.invalid',aud:'authenticated',role:'authenticated',created_at:now,email_confirmed_at:now,app_metadata:{provider:'email'},user_metadata:{}}));
 function jwt(id){const value=[{alg:'HS256',typ:'JWT'},{sub:id,aud:'authenticated',role:'authenticated',iss:upstream+'/raes/auth/v1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return value+'.'+createHmac('sha256',signingKey).update(value).digest('base64url');}
 const sessions=new Map(users.map(user=>[jwt(user.id),user])),tokenFor=id=>[...sessions].find(([,u])=>u.id===id)[0];
 const calls=[],unexpected=[],children=[],state={citizenState:'ACTIVO'};let citizenWrites=0;
 const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},async(req,res)=>{
  const url=new URL(req.url,upstream),realm=url.pathname.split('/')[1],path=url.pathname.replace(/^\/(raes|credenly)/,'');
  calls.push({realm,path,method:req.method});res.setHeader('Content-Type','application/json');
  const reply=(status,data)=>{res.statusCode=status;res.end(status===204?undefined:JSON.stringify(data));};
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null;
  const user=sessions.get(req.headers.authorization?.replace(/^Bearer /,'')??'');
  try{
   if(path==='/auth/v1/token'){const account=users.find(u=>u.email===body.email);if(!account||body.password!==password)return reply(400,{msg:'Invalid credentials'});return reply(200,{access_token:tokenFor(account.id),token_type:'bearer',expires_in:3600,refresh_token:randomBytes(32).toString('base64url'),user:account});}
   if(path==='/auth/v1/user')return user?reply(200,user):reply(401,{msg:'Invalid token',code:'bad_jwt'});
   if(path==='/auth/v1/logout')return reply(204,null);
   if(realm==='credenly'){
    if(req.method!=='GET'){citizenWrites++;return reply(500,{message:'Forbidden test mutation'});}
    if(path==='/rest/v1/perfiles_admin')return reply(200,[]);
    if(path==='/rest/v1/perfiles')return reply(200,[{id:citizenId,estado:state.citizenState}]);
    if(path==='/rest/v1/vinculaciones_raes')return reply(200,[{id:ids.admin,usuario_id:citizenId,raes_persona_id:master,verificacion_identidad_id:ids.auditor,estado:'VERIFICADA',metodo_verificacion:'OCR_DOCUMENTO',verified_at:now,created_at:now,updated_at:now}]);
    throw Error('Unexpected Credenly dependency');
   }
   if(path.startsWith('/rest/v1/rpc/')){
    const name=path.split('/').at(-1);assert.ok(['listar_revisiones_academicas','obtener_revision_academica','decidir_revision_academica','controlar_deteccion_academica','presentar_revision_academica'].includes(name));return reply(200,await rpc(db,name,body));
   }
   const table=path.split('/').at(-1),allowed=['perfiles_admin','instituciones','clientes_api','cliente_api_secretos','cliente_api_scopes','personas_maestra','credenciales','credencial_versiones','auditoria','integraciones_institucionales','integracion_secretos','integracion_scopes'];
   assert.ok(allowed.includes(table),'Unexpected local table');
   if(req.method==='POST'&&table==='auditoria'){await db.query('insert into auditoria(actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata) values($1,$2,$3,$4,$5,$6)',[body.actor_tipo,body.actor_id,body.accion,body.recurso_tipo,body.recurso_id??null,JSON.stringify(body.metadata)]);return reply(201,null);}
   if(req.method==='PATCH'&&['clientes_api','cliente_api_secretos','integraciones_institucionales','integracion_secretos'].includes(table))return reply(204,null);
   assert.ok(['GET','HEAD'].includes(req.method));
   const columns=(await db.query('select column_name from information_schema.columns where table_schema=\'public\' and table_name=$1',[table])).rows.map(r=>r.column_name),values=[],where=[];
   for(const [column,filter]of url.searchParams){if(!columns.includes(column))continue;values.push(filter.startsWith('eq.')?filter.slice(3):filter.startsWith('in.(')?filter.slice(4,-1).split(','):null);where.push(`t.${column} ${filter.startsWith('eq.')?'= $'+values.length:filter.startsWith('in.(')?'= any($'+values.length+'::uuid[])':'is null'}`);if(filter==='is.null')values.pop();}
   let sql=`select t.* from public.${table} t`,rows;
   if(table==='cliente_api_scopes')sql='select jsonb_build_object(\'codigo\',s.codigo) as scopes from cliente_api_scopes t join scopes s on s.id=t.scope_id';
   if(table==='integracion_scopes')sql='select jsonb_build_object(\'codigo\',s.codigo) as scopes from integracion_scopes t join scopes s on s.id=t.scope_id';
   if(table==='credenciales')sql="select t.*,to_jsonb(i) as instituciones,to_jsonb(p) as programas,to_jsonb(s) as sedes from credenciales t join instituciones i on i.id=t.institucion_id left join programas p on p.id=t.programa_id left join sedes s on s.id=t.sede_id";
   const versionFilter=url.searchParams.get('or');
   if(versionFilter){
    assert.equal(table,'credencial_versiones');
    const matches=[...versionFilter.matchAll(/and\(credencial_id\.eq\.([0-9a-f-]{36}),numero_version\.eq\.(\d+)\)/g)];
    assert.ok(matches.length>0);
    where.push('('+matches.map(m=>{values.push(m[1],Number(m[2]));return `(t.credencial_id=$${values.length-1}::uuid and t.numero_version=$${values.length}::int)`;}).join(' or ')+')');
   }
   if(where.length)sql+=' where '+where.join(' and ');
   const order=url.searchParams.get('order');
   if(order){const clauses=order.split(',').map(part=>{const [column,direction]=part.split('.');assert.ok(columns.includes(column));assert.ok(['asc','desc'].includes(direction));return `t.${column} ${direction}`;});sql+=' order by '+clauses.join(',');}
   rows=(await db.query(sql,values)).rows;
   const total=rows.length,start=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
   assert.ok(Number.isSafeInteger(start)&&start>=0&&Number.isSafeInteger(limit)&&limit>0);
   rows=rows.slice(start,start+limit);
   if(req.headers.prefer?.includes('count=exact'))res.setHeader('Content-Range',rows.length?`${start}-${start+rows.length-1}/${total}`:`*/${total}`);
   if(req.method==='HEAD')return reply(200,null);
   if(req.headers.accept?.includes('application/vnd.pgrst.object+json'))return reply(rows.length===1?200:406,rows[0]??{code:'PGRST116'});
   return reply(200,rows);
  }catch(error){
   const message=error instanceof Error?error.message:'';
   if(message.includes('REVIEW_'))return reply(400,{message:message.match(/REVIEW_[A-Z_]+/)[0],code:'P0001'});
   unexpected.push({realm,path,method:req.method});return reply(500,{message:'Local transport fixture failed'});
  }
 });
 server.listen(3543);await once(server,'listening');
 const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]));
 const common={...inherited,NODE_ENV:'production',NODE_EXTRA_CA_CERTS:cert};
 function start(dir,port,env){const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{cwd:join(root,dir),env:{...common,...env},stdio:'ignore'});children.push(child);}
 start('services/raes-api',3341,{RAES_SUPABASE_URL:upstream+'/raes',RAES_SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key-local-only-12345'});
 start('services/credenly-api',3342,{CREDENLY_SUPABASE_URL:upstream+'/credenly',CREDENLY_SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key-local-only-12345',RAES_API_BASE_URL:raes,RAES_CREDENLY_CLIENT_ID:clientId,RAES_CREDENLY_CLIENT_SECRET:secret});
 start('apps/raes-web',3340,{RAES_WEB_SUPABASE_URL:upstream+'/raes',RAES_WEB_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_fixture',RAES_API_BASE_URL:raes});
 async function stop(){for(const child of children)child.kill('SIGTERM');await Promise.all(children.map(c=>c.exitCode===null?once(c,'exit'):Promise.resolve()));await new Promise(r=>server.close(r));await db.close();rmSync(scratch,{recursive:true,force:true});}
 try{for(const path of [raes+'/api/v1/health',credenly+'/api/v1/health',base+'/login']){let ready=false;for(let i=0;i<100;i++){try{if((await fetch(path)).ok){ready=true;break;}}catch{ /* Optional local diagnostic or startup readiness poll; no private error output. */ }await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Local test application did not start');}}catch(error){await stop();throw error;}
 async function detectTitle(title,detectionId){
  const o=observation(),c=o.credenciales[0],p=o.persona;
  const snapshot={
   institution:{nit:'SYNTH-1',codigo_snies:null,nombre:'Institución sintética A',tipo_institucion:'UNIVERSIDAD',estado:'ACTIVA'},
   campuses:[{id:'campus-id',codigo:'CAMPUS',nombre:c.sede.nombre,departamento:null,municipio:null,direccion:null,estado:'ACTIVA'}],
   programs:[{id:'program-id',codigo_interno:'PROGRAM',codigo_snies:null,nombre:c.programa.nombre,nivel_formacion:null,modalidad:null,facultad:null,estado:'ACTIVO'}],
   programCampuses:[{id:'relation-id',programa_id:'program-id',sede_id:'campus-id',jornada:null,modalidad:null,estado:'ACTIVO'}],
   students:[{id:p.identificadorOrigen,tipo_documento:p.tipoDocumento,numero_documento:p.numeroDocumento,primer_nombre:p.primerNombre,segundo_nombre:null,primer_apellido:p.primerApellido,segundo_apellido:null,updated_at:o.sourceUpdatedAt}],
   enrollments:[{id:'enrollment-id',programa_sede_id:'relation-id',estudiante_id:p.identificadorOrigen}],
   credentials:[{id:c.identificadorOrigen,estudiante_id:p.identificadorOrigen,matricula_id:'enrollment-id',codigo:c.contenido.codigoOrigen,tipo:'DIPLOMA',titulo:title,descripcion:null,fecha_emision:'2026-11-01',fecha_grado:null,numero_acta:null,numero_folio:null,numero_libro:null,hash_documento:null,estado:'VIGENTE',created_at:o.sourceUpdatedAt,updated_at:o.sourceUpdatedAt}],
  };
  const summary=await detect(snapshot,new RaesClient({baseUrl:raes,clientId:'raes_cli_local_institution',clientSecret:secret,namespace:'poli'}),detectionId);
  const review=(await db.query("select id from solicitudes_revision_academica where estado='PENDIENTE' and entidad_tipo='CREDENCIAL' order by detectada_at desc limit 1")).rows[0];
  return {summary,id:review.id};
 }
 return {db,state,detectTitle,base,raes,credenly,users,password,institutionAuthorization:'Bearer raes_cli_local_institution.'+secret,tokenFor,citizenId,calls,unexpected,citizenWrites:()=>citizenWrites,stop,observation};
}
