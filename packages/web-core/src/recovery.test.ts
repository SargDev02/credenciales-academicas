import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recoveryProof, readRecoveryProof, proofMatches, validPassword, recoveryMessage } from './recovery';
import { sendRecovery, acceptRecovery, updateRecoveredPassword, type RecoveryContext } from './recovery-server';
const id='00000000-0000-4000-8000-000000000001',secret='synthetic-test-proof-key-not-a-real-secret';
function form(values:Record<string,string>){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;}
function fixture(){
 const jar=new Map<string,string>(),calls:string[]=[];
 const state={error:false,type:'recovery',denied:false,logoutFailure:false};
 let notify:(event:string)=>void=()=>{};
 const auth={auth:{
 onAuthStateChange:(callback:(event:string)=>void)=>{notify=callback;return {data:{subscription:{unsubscribe:()=>{}}}};},
 resetPasswordForEmail:async()=>{calls.push('send');return {error:state.error?{}:null};},
 exchangeCodeForSession:async()=>{if(!state.error)notify(state.type==='recovery'?'PASSWORD_RECOVERY':'SIGNED_IN');return {data:{session:{access_token:'synthetic-token'},user:{id}},error:state.error?{}:null};},
 getUser:async()=>({data:{user:{id}},error:state.error?{}:null}),
 getSession:async()=>({data:{session:{access_token:'synthetic-token'}},error:null}),
 updateUser:async()=>{calls.push('update');return {error:null};},
 signOut:async(options:{scope:string})=>{calls.push(options.scope);return {error:state.logoutFailure?{}:null};},
 }} as unknown as SupabaseClient;
 const c:RecoveryContext={service:'test-web',cookieBase:'test-auth',site:'https://app.example',prefix:'',secret,secure:true,
 jar:{get:n=>jar.has(n)?{value:jar.get(n)!}:undefined,getAll:()=>[...jar].map(([name,value])=>({name,value})),set:(n,v)=>jar.set(n,v),delete:n=>jar.delete(n)},
 auth:async()=>auth,admit:async()=>{calls.push('admit');},authorize:async()=>{calls.push('authorize');if(state.denied)throw new Error('denied');}};
 return {jar,calls,state,c};
}
test('recovery proof is time bounded, signed and bound to the verified user and exact token',()=>{
 const value=recoveryProof(secret,id,'synthetic-token',1000);
 assert.ok(readRecoveryProof(secret,value,1001));
 assert.equal(readRecoveryProof(secret,value+'x',1001),null);assert.equal(readRecoveryProof(secret,value+'.extra',1001),null);
 assert.equal(readRecoveryProof(secret,value,601001),null);
 assert.equal(readRecoveryProof(secret,value,0),null);
 assert.equal(proofMatches(readRecoveryProof(secret,value,1001)!,id,'other-token'),false);
 assert.equal(validPassword('short','short'),false);assert.equal(validPassword('synthetic-password','different'),false);
});
test('known, unknown and delivery failures have the same non-enumerating acknowledgement',async()=>{
 for(const fail of [false,true]){const f=fixture();f.state.error=fail;assert.deepEqual(await sendRecovery(f.c,form({email:'synthetic@example.invalid'})),{message:recoveryMessage});}
});
test('admission denial stops recovery mail before Auth and never returns provider details',async()=>{
 const f=fixture();f.c.admit=async()=>{throw new Error('private-detail');};
 const result=await sendRecovery(f.c,form({email:'synthetic@example.invalid'}));assert.ok(result.error);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(result).includes('private-detail'));
});
test('normal PKCE callbacks, invalid and expired codes cannot become password recovery',async()=>{
 const invalid=fixture();assert.ok((await acceptRecovery(invalid.c,form({code:'synthetic-code',sb_flow_id:'invalid-flow'}))).error);assert.equal(invalid.calls.length,0);
 for(const wrong of ['normal','error']){const f=fixture();f.state.type=wrong;f.state.error=wrong==='error';const r=await acceptRecovery(f.c,form({code:'synthetic-code'}));assert.ok(r.error);assert.equal(f.jar.size,0);}
});
test('verified recovery changes password only after own API authorization, revokes global sessions and clears scoped cookies',async()=>{
 const f=fixture();const r=await acceptRecovery(f.c,form({code:'synthetic-code'}));assert.equal(r.redirect,'/reset-password');
 f.jar.set('test-auth','old-session');f.jar.set('other-product-auth','preserved');
 const done=await updateRecoveredPassword(f.c,form({password:'synthetic-password-123',confirmation:'synthetic-password-123'}));
 assert.equal(done.done,true);assert.ok(f.calls.indexOf('authorize')<f.calls.indexOf('update'));assert.ok(f.calls.includes('global'));assert.deepEqual([...f.jar.keys()],['other-product-auth']);
});
test('missing proof, mismatch, restricted citizen and wrong administrative role never update password',async()=>{
 for(const scenario of ['missing','mismatch','denied']){
  const f=fixture();if(scenario!=='missing')await acceptRecovery(f.c,form({code:'synthetic-code'}));
  if(scenario==='mismatch')f.jar.set('test-auth-recovery-proof',recoveryProof(secret,id,'different-token'));
  f.state.denied=scenario==='denied';const r=await updateRecoveredPassword(f.c,form({password:'synthetic-password-123',confirmation:'synthetic-password-123'}));assert.ok(r.error);assert.ok(!f.calls.includes('update'));
 }
});
test('logout failure after a successful update is reported honestly and leaves no recovery cookie',async()=>{
 const f=fixture();await acceptRecovery(f.c,form({code:'synthetic-code'}));f.state.logoutFailure=true;
 const r=await updateRecoveredPassword(f.c,form({password:'synthetic-password-123',confirmation:'synthetic-password-123'}));assert.equal(r.done,true);assert.ok(r.error?.includes('Contraseña actualizada'));assert.equal(f.jar.size,0);
});
