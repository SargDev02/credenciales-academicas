import test from 'node:test';import assert from 'node:assert/strict';
import {withDetectionLease} from './runner';
const id='00000000-0000-4000-8000-000000000001';
test('lease release is fenced and reports whether detection failed',async()=>{
 const calls:unknown[]=[];const client={startDetection:async()=>({id}),finishDetection:async(...args:unknown[])=>{calls.push(args);}};
 assert.equal(await withDetectionLease(client,async()=>42,id),42);assert.deepEqual(calls,[[id,false]]);
});
test('release failure never masks the original detection failure; successful detection still fails if release fails',async()=>{
 const primary=new Error('primary'),release=new Error('release');
 const client={startDetection:async()=>({id}),finishDetection:async()=>{throw release;}};
 await assert.rejects(withDetectionLease(client,async()=>{throw primary;},id),e=>e===primary);
 await assert.rejects(withDetectionLease(client,async()=>true,id),e=>e===release);
});
