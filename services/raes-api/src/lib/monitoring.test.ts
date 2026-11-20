import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
import {queueSignal} from '../../scripts/lib/monitoring';
test('queue monitoring uses exact counts and oldest timestamp, never private proposal payloads or fabricated zero on failure',async()=>{
 const original=globalThis.fetch;let fail=false;
 globalThis.fetch=async input=>{const url=new URL(String(input));assert.equal(url.searchParams.get('select'),'detectada_at');return fail?Response.json({message:'private'},{status:500}):Response.json([{detectada_at:'2026-11-19T10:00:00Z'}],{headers:{'Content-Range':'0-0/12'}});};
 const db=createClient('https://local-fixture.invalid','synthetic-service-key',{auth:{persistSession:false}});
 try{assert.deepEqual(await queueSignal(db,Date.parse('2026-11-19T10:15:00Z')),{pending:12,oldestAgeMinutes:15});fail=true;await assert.rejects(queueSignal(db),/QUEUE_MONITOR_UNAVAILABLE/);}finally{globalThis.fetch=original;}
});
