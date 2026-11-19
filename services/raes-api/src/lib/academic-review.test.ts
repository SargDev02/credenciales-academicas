import assert from "node:assert/strict";
import test from "node:test";
import { submitAcademicReview,controlDetection,listAcademicReviews,readAcademicReview,decideAcademicReview,retiredInstitutionalWrite } from "./academic-review";
import { hashClientSecret } from "./api-credentials";
Object.assign(process.env,{RAES_SUPABASE_URL:"https://review-api-fixture.supabase.co",RAES_SUPABASE_SERVICE_ROLE_KEY:"fixture-server-only-never-public"});
const adminId="00000000-0000-4000-8000-000000000301",integrationId="00000000-0000-4000-8000-000000000101",institutionId="00000000-0000-4000-8000-000000000001",reviewId="00000000-0000-4000-8000-000000000401";
const secret="raes_sk_synthetic_review_secret",institutionToken=`raes_cli_review_fixture.${secret}`;
const observation={persona:{identificadorOrigen:"SYNTH-PERSON",tipoDocumento:"CC",numeroDocumento:"SYNTH-REVIEW-TEST",primerNombre:"Persona",primerApellido:"Sintética"},credenciales:[]};
function request(path:string,token:string|null="admin",body?:unknown){return new Request(`http://localhost/api/v1/${path}`,{method:body===undefined?"GET":"POST",headers:{...(token?{authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function fixture(options:{role?:string;state?:string;scopes?:string[];rpcError?:string;invalid?:boolean}={},run:(calls:{name:string;args:Record<string,unknown>}[])=>Promise<void>){
 const original=globalThis.fetch,calls:{name:string;args:Record<string,unknown>}[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.hostname,"review-api-fixture.supabase.co");
  if(url.pathname==="/auth/v1/user")return options.invalid?Response.json({msg:"invalid",code:"bad_jwt"},{status:401}):Response.json({id:adminId,aud:"authenticated",role:"authenticated",created_at:"2026-11-09",user_metadata:{rol:"SUPERADMIN"}});
  if(url.pathname==="/rest/v1/perfiles_admin")return Response.json([{id:adminId,nombres:"Admin",apellidos:"Sintético",rol:options.role??"ADMIN",estado:options.state??"ACTIVO"}]);
  if(url.pathname==="/rest/v1/integraciones_institucionales")return init?.method==="PATCH"?new Response(null,{status:204}):Response.json([{id:integrationId,institucion_id:institutionId,nombre:"Conector sintético",client_id:"raes_cli_review_fixture",estado:"ACTIVA"}]);
  if(url.pathname==="/rest/v1/instituciones")return Response.json([{estado:"ACTIVA"}]);
  if(url.pathname==="/rest/v1/integracion_secretos")return init?.method==="PATCH"?new Response(null,{status:204}):Response.json([{id:integrationId,secret_hash:hashClientSecret(secret),hash_algorithm:"SHA256",expires_at:null,revoked_at:null}]);
  if(url.pathname==="/rest/v1/integracion_scopes")return Response.json((options.scopes??["academic-review:submit"]).map(codigo=>({scopes:{codigo}})));
  assert.ok(url.pathname.startsWith("/rest/v1/rpc/"),"Review endpoints must not write canonical tables directly");
  const name=url.pathname.split("/").at(-1)!;const args=JSON.parse(String(init?.body));calls.push({name,args});
  if(options.rpcError)return Response.json({message:options.rpcError,details:"private SQL marker"},{status:400});
  if(name==="listar_revisiones_academicas")return Response.json({data:[],meta:{page:1,pageSize:20,total:0}});
  if(name==="controlar_deteccion_academica")return Response.json({id:reviewId,venceAt:"2026-11-09T12:00:00Z",estado:args.p_accion==="INICIAR"?"EN_CURSO":"COMPLETADA"});
  if(name==="decidir_revision_academica")return Response.json({id:reviewId,estado:args.p_accion==="APROBAR"?"APROBADA":"RECHAZADA",recursoRaesId:null,replayed:false});
  return Response.json({observaciones:[{id:reviewId,estado:"PENDIENTE",nueva:true}]});
 };
 try{await run(calls);}finally{globalThis.fetch=original;}
}
test("review routes require a verified session and private error responses",()=>fixture({invalid:true},async calls=>{
 for(const token of [null,"invalid"]){const r=await listAcademicReviews(request("admin/academic-reviews",token));assert.equal(r.status,401);assert.equal(r.headers.get("cache-control"),"private, no-store");}assert.equal(calls.length,0);
}));
for(const role of ["ADMIN","SUPERADMIN","AUDITOR"])test(`${role} can read a bounded inbox without editable metadata privileges`,()=>fixture({role},async calls=>{
 const r=await listAcademicReviews(request("admin/academic-reviews"));assert.equal(r.status,200);assert.equal(calls[0]!.args.p_admin_id,adminId);assert.deepEqual(calls[0]!.args.p_filtros,{page:1,pageSize:20});
}));
test("AUDITOR and inactive administrative profiles cannot approve or reject",async()=>{
 for(const options of [{role:"AUDITOR"},{state:"INACTIVO"}])await fixture(options,async calls=>{for(const action of ["APROBAR","RECHAZAR"] as const){const r=await decideAcademicReview(request("admin/academic-reviews", "admin",{motivo:"Revisión sintética"}),reviewId,action);assert.equal(r.status,403);}assert.equal(calls.length,0);});
});
test("institution cannot read or decide administrative reviews even with valid institutional credentials",()=>fixture({},async calls=>{
 assert.equal((await listAcademicReviews(request("admin/academic-reviews",institutionToken))).status,403);
 assert.equal((await decideAcademicReview(request("admin/academic-reviews",institutionToken,{motivo:"Intento institucional"}),reviewId,"APROBAR")).status,403);assert.equal(calls.length,0);
}));
test("institution submits under authenticated integration; omitted optional fields normalize",()=>fixture({},async calls=>{
 const r=await submitAcademicReview(request("academic-review/proposals",institutionToken,{deteccionId:reviewId,observacion:observation}));assert.equal(r.status,200);assert.equal(calls[0]!.args.p_integracion_id,integrationId);assert.ok(!("institucion_id" in calls[0]!.args));
 const body=calls[0]!.args.p_observacion as {persona:{segundoNombre:unknown}};assert.equal(body.persona.segundoNombre,null);
}));
test("missing explicit submit scope is 403 before proposal RPC",()=>fixture({scopes:["credentials:create"]},async calls=>{assert.equal((await submitAcademicReview(request("academic-review/proposals",institutionToken,{deteccionId:reviewId,observacion:observation}))).status,403);assert.equal(calls.length,0);}));
for(const extra of [{institucion_id:institutionId},{estado:"APROBADA"},{revisada_por:adminId}])test(`mass assignment ${Object.keys(extra)[0]} is rejected`,()=>fixture({},async calls=>{
 assert.equal((await submitAcademicReview(request("academic-review/proposals",institutionToken,{deteccionId:reviewId,observacion:observation,...extra}))).status,400);assert.equal(calls.length,0);
}));
test("oversized JSON is rejected before any proposal is stored",()=>fixture({},async calls=>{
 const r=await submitAcademicReview(request("academic-review/proposals",institutionToken,{deteccionId:reviewId,observacion:observation,extra:"x".repeat(65536)}));assert.equal(r.status,413);assert.equal(calls.length,0);
}));
for(const q of ["page=0","pageSize=101","page=1&page=2","q=%27%29%3Bdrop","desde=2026-02-30","institucion=invalid"])test(`invalid filter ${q} never reaches SQL`,()=>fixture({},async calls=>{
 assert.equal((await listAcademicReviews(request("admin/academic-reviews?"+q))).status,400);assert.equal(calls.length,0);
}));
test("reject without reason is 400 and approval uses the authenticated admin UUID",()=>fixture({},async calls=>{
 assert.equal((await decideAcademicReview(request("admin/academic-reviews","admin",{}),reviewId,"RECHAZAR")).status,400);
 const r=await decideAcademicReview(request("admin/academic-reviews","admin",{motivo:"Cambio aprobado"}),reviewId,"APROBAR");assert.equal(r.status,200);assert.equal(calls[0]!.args.p_admin_id,adminId);
}));
for(const error of ["REVIEW_STALE","REVIEW_TERMINAL_BLOCKED","REVIEW_CANONICAL_CHANGED"])test(`${error} stays conflict 409 without raw SQL`,()=>fixture({rpcError:error},async()=>{
 const r=await decideAcademicReview(request("admin/academic-reviews","admin",{motivo:"Cambio aprobado"}),reviewId,"APROBAR");assert.equal(r.status,409);assert.ok(!(await r.text()).includes("private"));
}));
test("missing review is 404; unexpected DB errors are sanitized 503",async()=>{
 await fixture({rpcError:"REVIEW_NOT_FOUND"},async()=>assert.equal((await readAcademicReview(request("admin/academic-reviews"),reviewId)).status,404));
 await fixture({rpcError:"private table detail"},async()=>{const r=await listAcademicReviews(request("admin/academic-reviews"));assert.equal(r.status,503);assert.ok(!(await r.text()).includes("private table"));});
});
test("detector lease start and finish derive their institution from authentication",()=>fixture({},async calls=>{
 assert.equal((await controlDetection(request("academic-review/detections",institutionToken))).status,200);
 assert.equal((await controlDetection(request("academic-review/detections",institutionToken,{deteccionId:reviewId,error:false}),true)).status,200);
 assert.deepEqual(calls.map(c=>c.args.p_integracion_id),[integrationId,integrationId]);
}));
test("legacy institutional writes are retired even if old write scopes remain",()=>fixture({scopes:["credentials:create","persons:sync"]},async calls=>{const r=await retiredInstitutionalWrite(request("credentials",institutionToken,{anything:true}));assert.equal(r.status,409);assert.equal((await r.json()).error,"ACADEMIC_REVIEW_REQUIRED");assert.equal(calls.length,0);}));
