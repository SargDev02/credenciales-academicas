import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {countTables} from './lib/academic-review-idempotence.mjs';
const root=resolve('../..'),historicalCommit='7636a2c';
const source=execFileSync('git',['show',`${historicalCommit}:services/raes-api/scripts/verify-academic-review-live.mjs`],{cwd:root,encoding:'utf8'});
const tail=source.slice(source.indexOf(' const stable=await counts(),repeat='),source.indexOf(' evidence.after=await counts();'));
const catchBody=source.match(/try\{await main\(\);\}catch\{([\s\S]*?)\}finally\{/)[1];
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const run=new AsyncFunction('counts','detect','approve','check','done','correction','evidence','stage','console','process',`try{${tail};evidence.result='PASS';}catch{${catchBody}}return evidence;`);
const snapshot=()=>Object.fromEntries(countTables.map(t=>[t,41]));
const cases=[];
for(const name of ['valid','detector-process-failure','http-replay-failure','unexpected-proposal','count-mismatch']){
 let reads=0;const result=await run(async()=>{const value=snapshot();if(name==='count-mismatch'&&++reads>1)value.credenciales++;return value;},async()=>{if(name==='detector-process-failure')throw new Error('simulated child failure');return {proposalsCreated:name==='unexpected-proposal'?1:0};},async()=>{if(name==='http-replay-failure')throw new Error('simulated transport failure');return {replayed:true};},ok=>{if(!ok)throw Error('LIVE_CHECK_FAILED');},()=>{},'synthetic-review',{},'APPROVAL_B',{error:()=>{}},{exitCode:0});
 cases.push({name,result,allDependenciesLocalStubs:true});
}
const evidence={mode:'OFFLINE_HISTORICAL_FINAL_BLOCK',historicalCommit,sourceSha256:createHash('sha256').update(source).digest('hex'),rootCauseAttribution:'Original exception not retained: distinct causes produce identical historical evidence. No exact historic trigger can be asserted.',cases,remoteRequests:0,writes:0};
const outputPath=`/tmp/academic-review-historical-reproduction-${Date.now()}.json`;writeFileSync(outputPath,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...evidence,outputPath}));
