import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { deploymentMode, validateProductionConfig } from "./deployment";
import { apiRequestLimit, LocalRequestLimiter } from "./security";
import { operationalLog, requestId } from "./observability";
export type Product = "RAES" | "CREDENLY";
export type AuthOperation = "login" | "register" | "recovery" | "recovery-exchange";
export class AdmissionError extends Error {
  constructor(public readonly status: 429 | 503, public readonly retryAfter = 60) { super("No fue posible admitir la solicitud. Intenta más tarde."); }
}
const local = new LocalRequestLimiter(64);
export function equalSecret(a: string | null, b: string | undefined): boolean {
  if (!a || !b || b.length < 32 || a.length > 512) return false;
  return timingSafeEqual(createHash("sha256").update(a).digest(),createHash("sha256").update(b).digest());
}
export function subjectHash(secret: string, value: string): string {
  return createHmac("sha256",secret).update(value.toLowerCase().trim()).digest("hex");
}
export function trustedClientIp(headers: Headers, env: Record<string,string | undefined>): string | null {
  // The owner must configure a header overwritten by the trusted ingress and
  // block direct origin access. Never infer trust from x-forwarded-for itself.
  const header = env.TRUSTED_CLIENT_IP_HEADER;
  if (!header) return null;
  if (!/^[a-z0-9-]{1,80}$/.test(header)) throw new AdmissionError(503);
  const value = headers.get(header)?.trim();
  if (!value || value.length > 45 || !isIP(value)) throw new AdmissionError(503);
  return value;
}
export async function consumeDatabaseLimit(env: Record<string,string|undefined>, product: Product, bucket: string, subject: string, limit: number, windowSeconds = 60) {
  const response = await fetch(new URL('/rest/v1/rpc/consume_production_limit',env[`${product}_SUPABASE_URL`]),{
    method:'POST',headers:{'Content-Type':'application/json',apikey:env[`${product}_SUPABASE_SERVICE_ROLE_KEY`]!,Authorization:`Bearer ${env[`${product}_SUPABASE_SERVICE_ROLE_KEY`]!}`},
    body:JSON.stringify({p_bucket:bucket,p_subject_hash:subject,p_limit:limit,p_window_seconds:windowSeconds}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000),
  }).catch(()=>{throw new AdmissionError(503);});
  const data: unknown = await response.json().catch(()=>null);
  if (!response.ok || !data || typeof data !== 'object' || !('allowed' in data) || typeof data.allowed !== 'boolean' || !('retryAfter' in data) || typeof data.retryAfter !== 'number' || !Number.isInteger(data.retryAfter) || data.retryAfter<0 || data.retryAfter>3600) throw new AdmissionError(503);
  if (!data.allowed) throw new AdmissionError(429,Math.max(1,data.retryAfter));
}
export async function enforceApiAdmission(request: Request, product: Product, env = process.env) {
  const path = new URL(request.url).pathname, policy = apiRequestLimit(path,request.method);
  const first = local.consume(policy);
  if (!first.allowed) throw new AdmissionError(429,first.retryAfter);
  if (path === '/api/v1/health' || deploymentMode(env) !== 'production') return;
  validateProductionConfig(env, product === 'RAES' ? 'raes-api' : 'credenly-api');
  const secret=env[`${product}_ADMISSION_SECRET`]!;
  await consumeDatabaseLimit(env,product,policy.bucket,subjectHash(secret,'global'),policy.limit);
  const ip = policy.bucket === "health" ? null : trustedClientIp(request.headers,env);
  if (ip) await consumeDatabaseLimit(env,product,policy.bucket,subjectHash(secret,`ip:${ip}`),policy.limit);
}
export async function enforceWebAdmission(product: Product, operation: AuthOperation, email: string, headers: Headers, env = process.env) {
  const limit = operation === 'recovery' ? 3 : operation === 'register' ? 5 : 10;
  if (deploymentMode(env) !== 'production') {
    const result=local.consume({bucket:`auth-${operation}`,limit:100,windowMs:60000});
    if(!result.allowed)throw new AdmissionError(429,result.retryAfter);
    return;
  }
  const secret=env[`${product}_ADMISSION_SECRET`];
  if (!secret || secret.length<32) throw new AdmissionError(503);
  const ip=trustedClientIp(headers,env);
  const response=await fetch(new URL('/api/v1/internal/admission',env[`${product}_API_BASE_URL`]),{
    method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json','x-request-id':requestId(headers.get("x-request-id"))},
    body:JSON.stringify({operation,subjects:[subjectHash(secret,`account:${email}`),...(ip?[subjectHash(secret,`ip:${ip}`)]:[])]}),
    cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000),
  }).catch(()=>{throw new AdmissionError(503);});
  if(!response.ok)throw new AdmissionError(response.status===429?429:503,Number(response.headers.get('retry-after'))||60);
  // Limits are fixed by the API. Never accept client-supplied limits or windows.
  void limit;
}
export async function internalAdmission(request: Request, product: Product, env = process.env): Promise<Response> {
  if(!equalSecret(request.headers.get('authorization')?.replace(/^Bearer /,'')??null,env[`${product}_ADMISSION_SECRET`])) return Response.json({error:'UNAUTHORIZED'},{status:401});
  try {
    // Bound the body before parsing; no emails, tokens or IPs cross this route.
    const reader=request.body?.getReader();let text='';
    if(reader)try{for(;;){const chunk=await reader.read();if(chunk.done)break;text+=new TextDecoder().decode(chunk.value);if(text.length>2048){await reader.cancel();return Response.json({error:'INVALID_REQUEST'},{status:413});}}}finally{reader.releaseLock();}
    const body: unknown=JSON.parse(text);
    if(!body||typeof body!=='object'||!('operation'in body)||!['login','register','recovery','recovery-exchange'].includes(String(body.operation))||!('subjects'in body)||!Array.isArray(body.subjects)||body.subjects.length<1||body.subjects.length>2||!body.subjects.every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)))return Response.json({error:'INVALID_REQUEST'},{status:400});
    const operation=String(body.operation),limit=operation==='recovery'?3:operation==='register'?5:10;
    if(deploymentMode(env)==='production') {
      validateProductionConfig(env,product==='RAES'?'raes-api':'credenly-api');
      for(const subject of [...new Set(body.subjects as string[])])await consumeDatabaseLimit(env,product,`auth-${operation}`,subject,limit,900);
    }
    return Response.json({allowed:true},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error){return admissionResponse(error,product.toLowerCase()+'-api');}
}
export function admissionResponse(error: unknown, service: string, id = requestId()): Response {
  const status = error instanceof AdmissionError ? error.status : 503;
  operationalLog(service,status===429?'RATE_LIMITED':'LIMIT_UNAVAILABLE',{requestId:id,status});
  return Response.json({error:status===429?'RATE_LIMITED':'ADMISSION_UNAVAILABLE',message:'No fue posible admitir la solicitud. Intenta más tarde.'},{status,headers:{'Retry-After':String(error instanceof AdmissionError?error.retryAfter:60),'Cache-Control':'private, no-store','X-Request-Id':id}});
}
