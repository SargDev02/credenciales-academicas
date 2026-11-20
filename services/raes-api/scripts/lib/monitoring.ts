import type {SupabaseClient} from '@supabase/supabase-js';
export async function queueSignal(db:SupabaseClient,now=Date.now()) {
 const result=await db.from('solicitudes_revision_academica').select('detectada_at',{count:'exact'}).eq('estado','PENDIENTE').order('detectada_at',{ascending:true}).limit(1);
 if(result.error||!Number.isSafeInteger(result.count)||result.count===null||result.count<0||!Array.isArray(result.data))throw Error('QUEUE_MONITOR_UNAVAILABLE');
 const first=result.data[0] as {detectada_at?:unknown}|undefined;
 const date=first?.detectada_at;
 if(result.count>0&&(typeof date!=='string'||!Number.isFinite(Date.parse(date))))throw Error('QUEUE_MONITOR_INCOMPLETE');
 return {pending:result.count,oldestAgeMinutes:typeof date==='string'?Math.max(0,Math.floor((now-Date.parse(date))/60000)):0};
}
