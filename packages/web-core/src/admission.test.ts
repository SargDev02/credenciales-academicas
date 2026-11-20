import test from 'node:test';
import assert from 'node:assert/strict';
import { equalSecret, subjectHash, trustedClientIp, consumeDatabaseLimit, internalAdmission, AdmissionError } from './admission';
import { operationalRecord, requestId } from './observability';
const secret='synthetic-test-server-secret-with-32-characters';
test('secret checks are bounded, subjects are HMACs and forwarded IPs are ignored unless explicitly trusted',()=>{
 assert.equal(equalSecret(secret,secret),true);assert.equal(equalSecret('wrong',secret),false);assert.equal(equalSecret(null,secret),false);
 assert.equal(subjectHash(secret,' TEST@EXAMPLE.INVALID '),subjectHash(secret,'test@example.invalid'));
 assert.equal(trustedClientIp(new Headers({'x-forwarded-for':'1.2.3.4'}),{}),null);
 assert.throws(()=>trustedClientIp(new Headers({'x-real-ip':'1.2.3.4,5.6.7.8'}),{TRUSTED_CLIENT_IP_HEADER:'x-real-ip'}));
 assert.equal(trustedClientIp(new Headers({'x-real-ip':'2001:db8::1'}),{TRUSTED_CLIENT_IP_HEADER:'x-real-ip'}),'2001:db8::1');
});
test('shared admission fails closed for missing RPC, invalid upstream, timeout and 429 without reflecting secrets',async()=>{
 const original=globalThis.fetch,env={RAES_SUPABASE_URL:'https://db.example',RAES_SUPABASE_SERVICE_ROLE_KEY:secret};
 try{for(const body of [{}, {allowed:false,retryAfter:25}]){
  globalThis.fetch=async(_url,init)=>{assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');return Response.json(body);};
  await assert.rejects(consumeDatabaseLimit(env,'RAES','test',subjectHash(secret,'global'),3),e=>e instanceof AdmissionError&&e.status===('allowed'in body?429:503)&&!e.message.includes(secret));
 }}finally{globalThis.fetch=original;}
});
test('internal admission requires server credentials before parsing data',async()=>{
 const result=await internalAdmission(new Request('http://local/internal',{method:'POST',body:'invalid'}),'RAES',{RAES_ADMISSION_SECRET:secret});assert.equal(result.status,401);
});
test('operational records whitelist fields, never paths, headers, tokens, IP, email or raw errors',()=>{
 const value=operationalRecord('raes-api','UNHANDLED_ERROR',{requestId:'bad\nprivate',status:503,error:'private',path:'/verify/private',Authorization:'private',email:'private',password:'private'});
 assert.equal(value.status,503);assert.ok(!JSON.stringify(value).includes('private'));assert.match(requestId(),/^[a-f0-9-]{36}$/);
});
