import assert from "node:assert/strict";
import test from "node:test";

import { buildRaesAuthorization } from "./raes-client";

test("construye Authorization de servicio Credenly -> RAES", () => {
  const header = buildRaesAuthorization(
    "raes_cli_test",
    "raes_sk_test",
  );

  assert.equal(
    header,
    "Bearer raes_cli_test.raes_sk_test",
  );
});

test("each credential request calls RAES with no-store; A then B is returned without a snapshot",async()=>{
 Object.assign(process.env,{CREDENLY_SUPABASE_URL:'https://citizen-local.example',CREDENLY_SUPABASE_SERVICE_ROLE_KEY:'local-fixture-service-only',RAES_API_BASE_URL:'https://raes-live.example',RAES_CREDENLY_CLIENT_ID:'raes_cli_local',RAES_CREDENLY_CLIENT_SECRET:'local-fixture-secret-only'});
 const {getRaesCredentialsForPerson}=await import('./raes-client');const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://raes-live.example/api/v1/persons/synthetic-person/credentials');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);calls++;return Response.json({data:[{id:'synthetic-credential',versionActual:calls,version:{titulo:calls===1?'A':'B'}}]});};
 try{assert.equal((await getRaesCredentialsForPerson('synthetic-person'))[0]?.version?.titulo,'A');assert.equal((await getRaesCredentialsForPerson('synthetic-person'))[0]?.version?.titulo,'B');assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
