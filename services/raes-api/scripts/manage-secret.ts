import { fileURLToPath } from "node:url";
import { getRaesSupabaseAdmin } from '../src/lib/supabase-admin';
import { generateClientSecret, hashClientSecret, getSecretLookupPrefix } from '../src/lib/api-credentials';
import { writeSecretFile } from './lib/secure-output.mjs';
const args=process.argv.slice(2), get=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
async function main(){
 const kind=get('kind'),owner=get('owner'),action=get('action'),target=get('secret-id'),output=get('output');
 if(!['INTEGRATION','CLIENT'].includes(kind??'')||!['PREPARE','REVOKE'].includes(action??'')||!/^[a-f0-9-]{36}$/.test(owner??''))throw Error('INVALID_OPTIONS');
 if(!args.includes('--execute')){console.log(JSON.stringify({dryRun:true,kind,owner,action,remoteRequests:0}));return;}
 if(!get('approval'))throw Error('OWNER_APPROVAL_REFERENCE_REQUIRED');
 const db=getRaesSupabaseAdmin();
 if(action==='PREPARE'){
  if(!output)throw Error('SECURE_OUTPUT_REQUIRED');
  const table=kind==='INTEGRATION'?'integraciones_institucionales':'clientes_api';
  const ownerRow=await db.from(table).select('client_id').eq('id',owner!).single();
  if(ownerRow.error||!ownerRow.data)throw Error('OWNER_LOOKUP_FAILED');
  const secret=generateClientSecret();
  writeSecretFile(output,JSON.stringify({clientId:ownerRow.data.client_id,clientSecret:secret})+'\n',fileURLToPath(new URL("../../..",import.meta.url)));
  // Retain the protected candidate on an ambiguous network failure. Never lose
  // a possibly committed secret or retry implicitly with different material.
  const result=await db.rpc('manage_raes_secret',{p_kind:kind,p_owner:owner,p_action:action,p_prefix:getSecretLookupPrefix(secret),p_hash:hashClientSecret(secret)});
  if(result.error||typeof result.data!=='string'||!/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(result.data))throw Error('PREPARE_UNCONFIRMED_KEEP_PROTECTED_CANDIDATE');
  console.log(JSON.stringify({action,owner,secretId:result.data,secretPrinted:false,oldSecretsRevoked:false}));
 }else{
  if(!/^[a-f0-9-]{36}$/.test(target??''))throw Error('SECRET_UUID_REQUIRED');
  const result=await db.rpc('manage_raes_secret',{p_kind:kind,p_owner:owner,p_action:action,p_secret:target});
  if(result.error)throw Error('REVOCATION_UNCONFIRMED');
  console.log(JSON.stringify({action,owner,secretId:target,secretPrinted:false}));
 }
}
main().catch(error=>{console.error(JSON.stringify({result:'FAIL',code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'SECRET_OPERATION_FAILED',secretPrinted:false}));process.exitCode=1;});
