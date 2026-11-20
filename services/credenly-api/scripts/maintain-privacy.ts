import { getCredenlySupabaseAdmin } from '../src/lib/supabase-admin';
const args=process.argv.slice(2), get=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
async function main(){
 const kind=get('kind'),days=Number(get('days')),limit=Number(get('limit')??500),execute=args.includes('--execute');
 if(!['RESOLVED_OCR_TEXT','SHARE_ACCESSES'].includes(kind??'')||!Number.isInteger(days)||days<1||days>36500||!Number.isInteger(limit)||limit<1||limit>1000)throw Error('INVALID_RETENTION_POLICY');
 if(execute&&!get('approval'))throw Error('OWNER_APPROVAL_REFERENCE_REQUIRED');
 const result=await getCredenlySupabaseAdmin().rpc('maintain_credenly_privacy',{p_kind:kind,p_before:new Date(Date.now()-days*86400000).toISOString(),p_execute:execute,p_limit:limit});
 if(result.error)throw Error('PRIVACY_MAINTENANCE_FAILED');
 const data:unknown=result.data;
 if(!data||typeof data!=='object'||!('selected'in data)||typeof data.selected!=='number'||!Number.isInteger(data.selected)||data.selected<0||data.selected>limit||!('executed'in data)||data.executed!==execute||!('kind'in data)||data.kind!==kind)throw Error('INVALID_MAINTENANCE_RESPONSE');
 console.log(JSON.stringify({timestamp:new Date().toISOString(),policy:get('approval')??null,dryRun:!execute,result:{selected:data.selected,executed:data.executed,kind:data.kind}}));
}
main().catch(()=>{console.error(JSON.stringify({result:'FAIL',code:'PRIVACY_MAINTENANCE_FAILED'}));process.exitCode=1;});
