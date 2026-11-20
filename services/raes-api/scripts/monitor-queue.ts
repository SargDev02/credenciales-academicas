import {getRaesSupabaseAdmin} from '../src/lib/supabase-admin';
import {queueSignal} from './lib/monitoring';
const get=(name:string)=>Number(process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3));
try {
 const maxPending=get('max-pending'),maxAge=get('max-age-minutes');
 if(!Number.isInteger(maxPending)||maxPending<1||!Number.isInteger(maxAge)||maxAge<1)throw Error('MONITOR_THRESHOLDS_REQUIRED');
 const value=await queueSignal(getRaesSupabaseAdmin()),alarm=value.pending>maxPending||value.oldestAgeMinutes>maxAge;
 console.log(JSON.stringify({status:alarm?'ALERT':'OK',...value}));if(alarm)process.exitCode=1;
}catch {console.error(JSON.stringify({status:'DOWN',code:'QUEUE_MONITOR_UNAVAILABLE'}));process.exitCode=1;}
