import test from 'node:test';import assert from 'node:assert/strict';
import {probeService} from '../monitor-service.mjs';import {verifyProductionInputs,externalActions} from '../verify-production-inputs.mjs';
test('health alone cannot hide readiness failure and monitor output never reflects private response content',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async input=>Response.json({message:'PRIVATE'}, {status:String(input).includes('/ready')?503:200});
 try{const result=await probeService('https://api.example');assert.equal(result.status,'DOWN');assert.equal(result.checks.health.up,true);assert.ok(!JSON.stringify(result).includes('PRIVATE'));}finally{globalThis.fetch=original;}
});
test('production signoff requires current release, fresh evidence and every owner action; never claims independent remote verification',()=>{
 const now=Date.now(),release='a'.repeat(40),actions=Object.fromEntries(externalActions.map(k=>[k,{verified:true,evidenceReference:'CHG-SYNTHETIC'}]));
 const input={version:1,scope:'closed-synthetic-pilot',release,verifiedAt:new Date(now).toISOString(),actions,rpoSeconds:3600,rtoSeconds:3600};
 assert.equal(verifyProductionInputs(input,release,now).status,'OWNER_ATTESTED');
 assert.equal(verifyProductionInputs({...input,release:'old'},release,now).status,'BLOCKED');
 assert.equal(verifyProductionInputs({...input,verifiedAt:null},release,now).status,'BLOCKED');
 delete actions.hostedAuthAndMail;assert.ok(verifyProductionInputs(input,release,now).blocked.includes('hostedAuthAndMail'));
});
