import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:https';
import {createServer as createHttpServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {guardFixtureRequest} from './http-fixture.ts';
export async function startRecoveryFixture(){
 const root=resolve(process.cwd()),scratch=mkdtempSync(join(tmpdir(),'recovery-local-')),key=join(scratch,'tls.key'),cert=join(scratch,'tls.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
 const upstream='https://localhost:3563',signingKey=randomBytes(32),pending=new Map(),sessions=new Map(),children=[];
 const users=[{id:'00000000-0000-4000-8000-000000000001',email:'admin@raes.invalid',realm:'raes',role:'ADMIN'},{id:'00000000-0000-4000-8000-000000000002',email:'citizen@credenly.invalid',realm:'credenly',role:'CITIZEN'},{id:'00000000-0000-4000-8000-000000000003',email:'admin@credenly.invalid',realm:'credenly',role:'ADMIN_CREDENLY'}];
 const state={lastLink:null,exchanges:0,updates:0,globalLogouts:0,expired:false,unexpected:[]};
 function session(user){const value=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');const token=value+'.'+createHmac('sha256',signingKey).update(value).digest('base64url');sessions.set(token,user);return {access_token:token,token_type:'bearer',expires_in:3600,refresh_token:randomBytes(32).toString('base64url'),user:{...user,aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}}};}
 const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},guardFixtureRequest(async(req,res)=>{
  const url=new URL(req.url,upstream),realm=url.pathname.split('/')[1],path=url.pathname.replace(/^\/(raes|credenly)/,'');let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{};
  const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(status===204?undefined:JSON.stringify(data));};
  const user=sessions.get(req.headers.authorization?.replace(/^Bearer /,'')??'');
  if(path==='/auth/v1/recover'){
   const account=users.find(u=>u.email===body.email&&u.realm===realm);state.lastLink=null;
   if(account){const code=randomBytes(16).toString('hex'),link=new URL(url.searchParams.get('redirect_to'));link.searchParams.set('code',code);pending.set(code,{account,challenge:body.code_challenge,used:false});state.lastLink=link.toString();}
   return reply(200,{});
  }
  if(path==='/auth/v1/token'){
   const value=pending.get(body.auth_code);state.exchanges++;
   if(!value||value.used||state.expired||value.account.realm!==realm||createHash('sha256').update(body.code_verifier??'').digest('base64url')!==value.challenge)return reply(400,{code:'otp_expired',msg:'Invalid recovery'});
   value.used=true;return reply(200,session(value.account));
  }
  if(path==='/auth/v1/user'){
   if(!user)return reply(401,{code:'bad_jwt',msg:'Invalid session'});
   if(req.method==='PUT'){assert.equal(typeof body.password,'string');state.updates++;}
   return reply(200,{...user,aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}});
  }
  if(path==='/auth/v1/logout'){
   if(url.searchParams.get('scope')==='global'){state.globalLogouts++;for(const [token,account]of sessions)if(account.id===user?.id)sessions.delete(token);}
   return reply(204,null);
  }
  if(path==='/api/v1/admin/me'||path==='/api/v1/auth/me'){
   const ok=user&&user.realm===realm&&(path.includes('/admin/')?user.role!=='CITIZEN':user.role==='CITIZEN');
   return reply(ok?200:403,ok?{data:{id:user.id,nombres:'Synthetic',apellidos:'Recovery',rol:user.role,estado:'ACTIVO'}}:{error:'FORBIDDEN'});
  }
  state.unexpected.push({path,method:req.method});return reply(500,{error:'UNEXPECTED_LOCAL_DEPENDENCY'});
 }));
 server.listen(3563);await once(server,'listening');
 const apiServers=[];
 for(const [realm,port]of [['raes',3361],['credenly',3362]]){
  const api=createHttpServer((req,res)=>{
   const user=sessions.get(req.headers.authorization?.replace(/^Bearer /,'')??'');
   const path=new URL(req.url,'http://localhost').pathname;
   const known=['/api/v1/admin/me','/api/v1/auth/me'].includes(path);
   if(!known)state.unexpected.push({path,method:req.method});
   const ok=known&&user&&user.realm===realm&&(path.includes('/admin/')?user.role!=='CITIZEN':user.role==='CITIZEN');
   res.statusCode=ok?200:403;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(ok?{data:{id:user.id,nombres:'Synthetic',apellidos:'Recovery',rol:user.role,estado:'ACTIVO'}}:{error:'FORBIDDEN'}));
  });api.listen(port);await once(api,'listening');apiServers.push(api);
 }
 const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]));
 for(const [product,port]of [['raes',3360],['credenly',3363]]){
  const prefix=product.toUpperCase(),env={...inherited,NODE_ENV:'production',APP_ENV:'test',NODE_EXTRA_CA_CERTS:cert,[`${prefix}_WEB_SUPABASE_URL`]:upstream+'/'+product,[`${prefix}_WEB_SUPABASE_PUBLISHABLE_KEY`]:'sb_publishable_local_fixture',[`${prefix}_API_BASE_URL`]:`http://localhost:${product==='raes'?3361:3362}`,[`${prefix}_WEB_SITE_URL`]:`http://localhost:${port}`,[`${prefix}_ADMISSION_SECRET`]:randomBytes(32).toString('base64url')};
  children.push(spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{cwd:join(root,`apps/${product}-web`),env,stdio:'ignore'}));
 }
 async function stop(){for(const child of children)child.kill('SIGTERM');await Promise.all(children.map(c=>c.exitCode===null?once(c,'exit'):Promise.resolve()));await Promise.all([server,...apiServers].map(s=>new Promise(r=>s.close(r))));rmSync(scratch,{recursive:true,force:true});}
 try{for(const port of [3360,3363]){let ready=false;for(let n=0;n<100;n++){try{if((await fetch(`http://localhost:${port}/forgot-password`)).ok){ready=true;break;}}catch{/* Startup poll only. */}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Recovery fixture did not start');}}catch(error){await stop();throw error;}
 return {state,users,stop,raes:'http://localhost:3360',credenly:'http://localhost:3363'};
}
