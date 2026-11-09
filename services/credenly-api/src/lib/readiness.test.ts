import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/v1/health/ready/route";
Object.assign(process.env, {
 CREDENLY_SUPABASE_URL:"https://readiness-fixture.supabase.co",
 CREDENLY_SUPABASE_SERVICE_ROLE_KEY:"fixture-server-key-never-public",
 RAES_API_BASE_URL:"https://raes-fixture.example",
 RAES_CREDENLY_CLIENT_ID:"raes_cli_fixture",
 RAES_CREDENLY_CLIENT_SECRET:"fixture-raes-secret-never-public",
});
for(const failed of [null,"database","auth","raes"] as const) {
 test(`readiness actually verifies Auth, DB and RAES; failed=${failed}`,async()=>{
  const original=globalThis.fetch;const paths:string[]=[];
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));paths.push(url.pathname);
   assert.ok(!init?.method||init.method==="GET"||init.method==="HEAD");
   if(url.pathname==="/rest/v1/perfiles")return new Response(null,{status:failed==="database"?500:200,headers:{"content-range":"0-0/2"}});
   if(url.pathname==="/auth/v1/admin/users")return failed==="auth"?Response.json({message:"private auth detail"},{status:403}):Response.json({users:[],aud:"authenticated"});
   assert.equal(url.hostname,"raes-fixture.example");assert.equal(url.pathname,"/api/v1/auth/client-whoami");
   assert.equal(init?.cache,"no-store");
   return failed==="raes"?Response.json({message:"private SQL marker"},{status:503}):Response.json({data:{scopes:["credentials:read","persons:resolve"]}});
  };
  try{
   const response=await GET();assert.equal(response.status,failed?503:200);const body=await response.json();
   for(const component of ["database","auth","raes"])assert.equal(body.components[component],failed===component?"down":"up");
   assert.ok(paths.includes("/auth/v1/admin/users"));assert.ok(!JSON.stringify(body).includes("private"));
  }finally{globalThis.fetch=original;}
 });
}
