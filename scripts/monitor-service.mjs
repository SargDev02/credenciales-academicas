import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export async function probeService(origin,kind="api"){
 if(!["api","web"].includes(kind))throw Error("INVALID_SERVICE_KIND");
 const base=new URL(origin);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('INVALID_MONITOR_ORIGIN');
 const results={};
 for(const [name,path]of [['health',kind==='web'?'/api/health':'/api/v1/health'],['ready',kind==='web'?'/api/health/ready':'/api/v1/health/ready']]){
  try{const response=await fetch(new URL(path,base),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});results[name]={up:response.ok,status:response.status};}
  catch{results[name]={up:false,status:0};}
 }
 return {status:results.health.up&&results.ready.up?'UP':'DOWN',checks:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const r=await probeService(process.argv[2],process.argv[3]??"api");console.log(JSON.stringify(r));if(r.status!=='UP')process.exitCode=1;}catch{console.error(JSON.stringify({status:'DOWN',code:'INVALID_MONITOR_CONFIGURATION'}));process.exitCode=1;}
}
