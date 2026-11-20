import test from "node:test";
import assert from "node:assert/strict";
import { configurationUrl, deploymentMode, siteOrigin, validateProductionConfig, type Service } from "./deployment";
test("production is strict by default, has no implicit localhost and errors redact values", () => {
  assert.equal(deploymentMode({NODE_ENV:"production"}),"production");
  assert.throws(()=>siteOrigin({NODE_ENV:"production"},"CREDENLY"),/CREDENLY_WEB_SITE_URL/);
  for(const url of ['http://api.example','https://localhost','https://127.0.0.1','https://10.1.2.3','https://192.168.1.1','https://[::1]','https://user:private@api.example','https://api.example?token=private','https://api.example/path']) {
    assert.throws(()=>configurationUrl(url,'API_URL',true),e=>e instanceof Error && e.message==='Configuración inválida: API_URL');
  }
  assert.equal(configurationUrl('https://api.example','URL',true).origin,'https://api.example');
});
test("all six deployment profiles reject missing production configuration; local tests are explicit",()=>{
  for(const service of ['raes-api','credenly-api','raes-web','credenly-web','poli','udea'] as Service[]) {
    assert.throws(()=>validateProductionConfig({NODE_ENV:'production'},service));
    validateProductionConfig({NODE_ENV:'production',APP_ENV:'test'},service);
  }
  assert.throws(()=>deploymentMode({APP_ENV:'staging-typo'}));
});
test("public privileged variables are always rejected",()=>{
  assert.throws(()=>validateProductionConfig({NEXT_PUBLIC_SERVICE_ROLE_KEY:'private'},'raes-web'),/prohibida/);
  assert.equal(siteOrigin({APP_ENV:'local'},'RAES'),'http://localhost:3000');
});

test('closed pilot requires explicit cohort and cannot accidentally enable public real-data exposure',async()=>{
 const {pilotUserAllowed,pilotEmailAllowed,selfRegistrationAllowed}=await import('./pilot');
 const id='00000000-0000-4000-8000-000000000001',env={APP_ENV:'production',EXPOSURE_SCOPE:'closed-synthetic-pilot',PILOT_ALLOWED_USER_IDS:id,PILOT_ALLOWED_EMAILS:'synthetic@fixture.invalid'};
 assert.equal(selfRegistrationAllowed(env),false);
 assert.equal(pilotUserAllowed(id,env),true);assert.equal(pilotUserAllowed('00000000-0000-4000-8000-000000000002',env),false);
 assert.equal(pilotEmailAllowed(' SYNTHETIC@FIXTURE.INVALID ',env),true);assert.equal(pilotEmailAllowed('outside@fixture.invalid',env),false);
 assert.equal(pilotUserAllowed(id,{...env,EXPOSURE_SCOPE:'public-real'}),false);
});

test('a complete isolated web profile passes and rejects keys belonging to another product',()=>{
 const env={APP_ENV:'production',EXPOSURE_SCOPE:'closed-synthetic-pilot',TRUSTED_CLIENT_IP_HEADER:'x-real-ip',PILOT_ALLOWED_EMAILS:'synthetic@fixture.invalid',RAES_WEB_SUPABASE_URL:'https://raes.example',RAES_API_BASE_URL:'https://raes-api.example',RAES_WEB_SITE_URL:'https://raes-web.example',RAES_WEB_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only',RAES_ADMISSION_SECRET:'synthetic-shared-admission-secret-for-tests'};
 validateProductionConfig(env,'raes-web');
 assert.throws(()=>validateProductionConfig({...env,CREDENLY_ADMISSION_SECRET:'synthetic-other-product-secret-for-tests'},'raes-web'),/Secreto ajeno/);
 assert.throws(()=>validateProductionConfig({...env,RAES_WEB_SUPABASE_PUBLISHABLE_KEY:'sb_secret_'+'synthetic'.repeat(6)},'raes-web'),/PUBLISHABLE_KEY/);
});
