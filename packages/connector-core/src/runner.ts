import { operationalLog } from "@raes/web-core/observability";
import { RaesClient, type RaesConnectorConfig } from "./raes-client";
import { createInstitutionSourceClient, readInstitutionalSnapshot, type SourceConfig } from "./source";
import { parseDetectionArgs } from "./academic-review";
import { detect } from "./sync";

type LeaseClient = { startDetection():Promise<{id:string}>; finishDetection(id:string,failed:boolean):Promise<unknown> };
export async function withDetectionLease<T>(client:LeaseClient,run:(id:string)=>Promise<T>,correlationId:string):Promise<T> {
 const lease=await client.startDetection();
 let outcome:{ok:true;value:T}|{ok:false;error:unknown};
 try {outcome={ok:true,value:await run(lease.id)};}
 catch(error){outcome={ok:false,error};}
 try {await client.finishDetection(lease.id,!outcome.ok);}
 catch(error){operationalLog('connector','CONNECTOR_RELEASE_FAILED',{requestId:correlationId});if(outcome.ok)throw error;}
 if(!outcome.ok)throw outcome.error;
 return outcome.value;
}
export async function runDetection(sourceConfig: SourceConfig, apiConfig: RaesConnectorConfig, args: string[]): Promise<void> {
 const options=parseDetectionArgs(args),raes=new RaesClient(apiConfig),controller=new AbortController();
 operationalLog('connector','CONNECTOR_STARTED',{requestId:raes.correlationId});
 try{
  const summary=await withDetectionLease(raes,async lease=>{
   const source=createInstitutionSourceClient({...sourceConfig,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
   const snapshot=await readInstitutionalSnapshot(source);
   return detect(snapshot,raes,lease,options.credentialCode);
  },raes.correlationId);
  console.log(JSON.stringify({operation:'DETECT_AND_SUBMIT',requestId:raes.correlationId,...summary}));
  operationalLog('connector','CONNECTOR_COMPLETED',{requestId:raes.correlationId,canonicalWrites:summary.canonicalWrites,proposalsCreated:summary.proposalsCreated});
 }catch(error){operationalLog('connector','CONNECTOR_FAILED',{requestId:raes.correlationId});throw error;}
 finally{controller.abort();}
}
