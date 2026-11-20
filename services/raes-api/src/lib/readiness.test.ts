import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../app/api/v1/health/ready/route';
test('RAES readiness checks Auth as well as the database and redacts failures',async()=>{
 const oldFetch=globalThis.fetch,env={url:process.env.RAES_SUPABASE_URL,key:process.env.RAES_SUPABASE_SERVICE_ROLE_KEY,mode:process.env.APP_ENV};
 process.env.RAES_SUPABASE_URL='https://local-test.example';process.env.RAES_SUPABASE_SERVICE_ROLE_KEY='synthetic-service-key-for-local-tests';process.env.APP_ENV='test';
 let authUp=true;
 globalThis.fetch=async input=>String(input).includes('/auth/v1/')?Response.json(authUp?{users:[]}:{msg:'PRIVATE_FAILURE'},{status:authUp?200:503}):new Response(null,{headers:{'Content-Range':'*/0'}});
 try{
  const good=await GET();assert.equal(good.status,200);assert.equal((await good.json()).components.auth,'up');
  authUp=false;const bad=await GET();assert.equal(bad.status,503);assert.ok(!(await bad.text()).includes('PRIVATE_FAILURE'));
 }finally{globalThis.fetch=oldFetch;for(const [key,value]of [['RAES_SUPABASE_URL',env.url],['RAES_SUPABASE_SERVICE_ROLE_KEY',env.key],['APP_ENV',env.mode]]){if(value===undefined)delete process.env[key!];else process.env[key!]=value;}}
});
