import {execFileSync} from 'node:child_process';

export const countTables=['personas_maestra','persona_fuentes','credenciales','credencial_versiones','credencial_eventos','operaciones_api'];
export class OperatorError extends Error {
 constructor(code,details={}){super(code);this.name='OperatorError';this.code=code;this.details=details;}
}
export function safeDiagnostic(error,stage){
 const result={stage,code:error instanceof OperatorError?error.code:'OPERATOR_STEP_FAILED'};
 if(['OperatorError','Error','TypeError','SyntaxError','AssertionError','AbortError','TimeoutError'].includes(error?.name))result.errorType=error.name;
 if(error instanceof OperatorError){
  for(const key of ['table','field','before','after','proposalsCreated','exitCode','signal','causeCode','httpStatus']){
   const value=error.details[key];
   if(['before','after','proposalsCreated','exitCode','httpStatus'].includes(key)&&Number.isSafeInteger(value))result[key]=value;
   if(key==='table'&&countTables.includes(value))result[key]=value;
   if(key==='field'&&['studentsObserved','credentialsObserved','proposalsCreated','observationsUnchanged','canonicalWrites'].includes(value))result[key]=value;
   if(key==='signal'&&typeof value==='string'&&/^SIG[A-Z]{1,15}$/.test(value))result[key]=value;
   if(key==='causeCode'&&typeof value==='string'&&/^(?:E[A-Z0-9_]+|UND_ERR_[A-Z0-9_]+)$/.test(value))result[key]=value;
  }
 }
 for(const [key,value] of [['exitCode',error?.status],['signal',error?.signal],['causeCode',error?.cause?.code]]){
  if(key==='exitCode'&&Number.isInteger(value))result[key]=value;
  if(key==='signal'&&typeof value==='string'&&/^SIG[A-Z]{1,15}$/.test(value))result[key]=value;
  if(key==='causeCode'&&typeof value==='string'&&/^(?:E[A-Z0-9_]+|UND_ERR_[A-Z0-9_]+)$/.test(value))result[key]=value;
 }
 return result; // Never serialize message, stack, stderr, request, headers or body.
}
export function validateCounts(counts){
 for(const table of countTables)if(!Number.isSafeInteger(counts?.[table])||counts[table]<0)throw new OperatorError('COUNTER_VALUE_INVALID',{table});
 return counts;
}
export function parseDetectionOutput(out){
 const values=out.split('\n').flatMap(line=>{try{const value=JSON.parse(line);return value?.operation==='DETECT_AND_SUBMIT'?[value]:[];}catch{return [];}});
 if(values.length!==1)throw new OperatorError('DETECTION_SUMMARY_INVALID');
 const summary=values[0];
 for(const field of ['studentsObserved','credentialsObserved','proposalsCreated','observationsUnchanged','canonicalWrites'])if(!Number.isSafeInteger(summary[field])||summary[field]<0)throw new OperatorError('DETECTION_SUMMARY_INVALID',{field});
 if(summary.canonicalWrites!==0)throw new OperatorError('CANONICAL_WRITES_UNEXPECTED');
 return Object.fromEntries(['operation','studentsObserved','credentialsObserved','proposalsCreated','observationsUnchanged','canonicalWrites'].map(key=>[key,summary[key]]));
}
export function detectFixture({root,credentialCode,execute=execFileSync}){
 let out;
 try{out=execute('pnpm',['--filter','@raes/connector-poli','detect','--','--credential-code='+credentialCode],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}
 catch(error){const diagnostic=safeDiagnostic(error,'IDEMPOTENCE_DETECTION');throw new OperatorError('DETECTION_PROCESS_FAILED',diagnostic);}
 return parseDetectionOutput(out);
}
export async function verifyIdempotence({counts,detect,replay,onStage=()=>{},record=()=>{}}){
 let stage;
 const step=async(name,run)=>{
  stage=name;onStage(name);
  try{return await run();}catch(error){const diagnostic=safeDiagnostic(error,stage);record('failure',diagnostic);throw Object.assign(error instanceof Error?error:new OperatorError('OPERATOR_STEP_FAILED'),{operatorDiagnostic:diagnostic});}
 };
 const before=await step('IDEMPOTENCE_COUNTS_BEFORE',async()=>validateCounts(await counts()));record('beforeCounts',before);
 const detection=await step('IDEMPOTENCE_DETECTION',async()=>{
  const result=parseDetectionOutput(JSON.stringify(await detect()));
  if(result.proposalsCreated!==0)throw new OperatorError('UNEXPECTED_NEW_PROPOSALS',{proposalsCreated:result.proposalsCreated});return result;
 });record('detection',detection);
 const decision=await step('IDEMPOTENCE_REPLAY',async()=>{
  const result=await replay();if(result?.replayed!==true||result?.estado!=='APROBADA')throw new OperatorError('DECISION_NOT_REPLAYED');return result;
 });record('replay',{id:decision.id,estado:decision.estado,replayed:decision.replayed,recursoRaesId:decision.recursoRaesId});
 const after=await step('IDEMPOTENCE_COUNTS_AFTER',async()=>{
  const result=validateCounts(await counts());
  for(const table of countTables)if(result[table]!==before[table])throw new OperatorError('CANONICAL_COUNT_CHANGED',{table,before:before[table],after:result[table]});return result;
 });record('afterCounts',after);
 return {detection,replay:decision,beforeCounts:before,afterCounts:after};
}
