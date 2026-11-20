import test from 'node:test';import assert from 'node:assert/strict';
import { authenticateAdmin } from './admin-auth';
test('production Auth UUID outside the closed pilot is denied before profile or academic data access',async()=>{
 const original=globalThis.fetch;
 Object.assign(process.env,{APP_ENV:'production',EXPOSURE_SCOPE:'closed-synthetic-pilot',TRUSTED_CLIENT_IP_HEADER:'x-real-ip',PILOT_ALLOWED_USER_IDS:'00000000-0000-4000-8000-000000000002',RAES_SUPABASE_URL:'https://raes.fixture.invalid',RAES_SUPABASE_SERVICE_ROLE_KEY:'sb_secret_'+'synthetic'.repeat(6),RAES_ADMISSION_SECRET:'synthetic-server-secret-for-local-tests-only'});
 let profiles=0;
 globalThis.fetch=async input=>{if(String(input).includes('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',created_at:'2026-11-19'});profiles++;throw new Error('Private lookup should not run');};
 try{await assert.rejects(authenticateAdmin(new Request('https://api.fixture.invalid/',{headers:{Authorization:'Bearer synthetic-token'}})),e=>e instanceof Error&&'status'in e&&e.status===403);assert.equal(profiles,0);}finally{globalThis.fetch=original;}
});
