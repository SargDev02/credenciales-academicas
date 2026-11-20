import { pilotEmailAllowed } from "./pilot";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recoveryMessage, recoveryProof, readRecoveryProof, proofMatches, validPassword, recoveryFlowId, type RecoveryState } from "./recovery";
import { operationalLog } from "./observability";
import type { AuthOperation } from "./admission";
export type CookiePort = {
 get(name:string):{value:string}|undefined;
 getAll():{name:string;value:string}[];
 set(name:string,value:string,options:{httpOnly:boolean;sameSite:'lax';secure:boolean;path:string;maxAge:number}):unknown;
 delete(name:string):unknown;
};
export type RecoveryContext = {
 service:string; cookieBase:string; site:string; prefix:string; secret:string; secure:boolean;
 jar:CookiePort; auth:()=>Promise<SupabaseClient>;
 admit:(operation:AuthOperation,subject:string)=>Promise<void>;
 authorize:(token:string,userId:string)=>Promise<void>;
};
export function clearRecovery(c:RecoveryContext) {
 const name=c.cookieBase+'-recovery';
 for(const cookie of c.jar.getAll())if(cookie.name===name||cookie.name.startsWith(name+'.')||cookie.name.startsWith(name+'-'))c.jar.delete(cookie.name);
}
export async function sendRecovery(c:RecoveryContext,form:FormData):Promise<RecoveryState> {
 const email=form.get('email');
 if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return {error:'Revisa el correo.'};
 try{await c.admit('recovery',email);}catch{return {error:'No fue posible admitir la solicitud. Intenta más tarde.'};}
 if(!pilotEmailAllowed(email))return {message:recoveryMessage};
 try {
  const auth=await c.auth();
  const result=await auth.auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL(c.prefix+'/auth/recovery',c.site).toString()});
  if(result.error)operationalLog(c.service,'RECOVERY_DELIVERY_FAILED');
 }catch{operationalLog(c.service,'RECOVERY_DELIVERY_FAILED');}
 return {message:recoveryMessage};
}
export async function acceptRecovery(c:RecoveryContext,form:FormData):Promise<RecoveryState&{redirect?:string}> {
 const code=form.get('code'),rawFlowId=form.get('sb_flow_id'),flowId=recoveryFlowId(rawFlowId);
 if(rawFlowId && !flowId)return {error:'El enlace no está disponible o venció. Solicita uno nuevo.'};
 if(typeof code!=='string'||!code||code.length>2048)return {error:'El enlace no está disponible o venció. Solicita uno nuevo.'};
 try {
  await c.admit('recovery-exchange','recovery');
  const auth=await c.auth();
  let recoverySession=false;
  const {data:listener}=auth.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')recoverySession=true;});
  const result=await auth.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined).finally(()=>listener.subscription.unsubscribe());
  const {data,error}=result;
  if(!error&&data.session&&recoverySession) {
   const verified=await auth.auth.getUser();
   if(!verified.error&&verified.data.user?.id===data.user?.id) {
    c.jar.set(c.cookieBase+'-recovery-proof',recoveryProof(c.secret,data.user.id,data.session.access_token),{httpOnly:true,sameSite:'lax',secure:c.secure,path:'/',maxAge:600});
    return {redirect:c.prefix+'/reset-password'};
   }
  }
  await auth.auth.signOut({scope:'local'});
 }catch{ /* No raw SDK/URL/code in public output. */ }
 clearRecovery(c);
 return {error:'El enlace no está disponible o venció. Solicita uno nuevo.'};
}
export async function updateRecoveredPassword(c:RecoveryContext,form:FormData):Promise<RecoveryState> {
 const password=form.get('password');
 if(!validPassword(password,form.get('confirmation')))return {error:'Usa entre 12 y 256 caracteres y confirma la misma contraseña.'};
 const proof=readRecoveryProof(c.secret,c.jar.get(c.cookieBase+'-recovery-proof')?.value);
 if(!proof){clearRecovery(c);return {error:'La sesión de recuperación venció. Solicita un enlace nuevo.'};}
 let changed=false;
 try {
  const auth=await c.auth();
  const verified=await auth.auth.getUser(),session=await auth.auth.getSession();
  const user=verified.data.user,token=session.data.session?.access_token;
  if(verified.error||!user||!token||!proofMatches(proof,user.id,token))return {error:'La sesión de recuperación no está disponible.'};
  await c.authorize(token,user.id);
  const result=await auth.auth.updateUser({password});
  if(result.error)return {error:'No fue posible actualizar la contraseña. Solicita otro enlace si persiste.'};
  changed=true;
  const ended=await auth.auth.signOut({scope:'global'});
  if(ended.error)throw new Error('Global logout unavailable');
  return {message:'Contraseña actualizada. Inicia sesión de nuevo.',done:true};
 }catch {
  return changed?{error:'Contraseña actualizada. No se pudo confirmar el cierre global; contacta al administrador.',done:true}:{error:'No fue posible completar la recuperación. Intenta nuevamente.'};
 }finally {
  if(changed)for(const cookie of c.jar.getAll())if(cookie.name===c.cookieBase||cookie.name.startsWith(c.cookieBase+'.')||cookie.name.startsWith(c.cookieBase+'-recovery'))c.jar.delete(cookie.name);
 }
}
