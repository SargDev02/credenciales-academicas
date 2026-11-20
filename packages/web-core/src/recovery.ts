import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const recoveryMessage = "Si la cuenta puede recuperarse, recibirás instrucciones en su correo. Revisa también spam.";
export type RecoveryState = { error?: string; message?: string; done?: boolean };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function recoveryProof(secret: string, userId: string, accessToken: string, now = Date.now()) {
  const data=Buffer.from(JSON.stringify({userId,tokenHash:hash(accessToken),expires:now+600000})).toString('base64url');
  return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
}
export function readRecoveryProof(secret: string, value: string | undefined, now = Date.now()): {userId:string;tokenHash:string} | null {
  if(!value || value.length>1024)return null;
  const parts=value.split('.');if(parts.length!==2)return null;
  const [data,signature]=parts;if(!data || !signature)return null;
  const expected=createHmac('sha256',secret).update(data).digest('base64url');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
  try {const parsed:unknown=JSON.parse(Buffer.from(data,'base64url').toString());
    if(!parsed||typeof parsed!=='object'||!('expires'in parsed)||typeof parsed.expires!=='number'||parsed.expires<=now||parsed.expires>now+600000||!('userId'in parsed)||typeof parsed.userId!=='string'||!('tokenHash'in parsed)||typeof parsed.tokenHash!=='string')return null;
    return {userId:parsed.userId,tokenHash:parsed.tokenHash};
  } catch{return null;}
}
export function proofMatches(proof: {userId:string;tokenHash:string}, userId: string, token: string) { return proof.userId===userId && proof.tokenHash===hash(token); }
export function validPassword(password: unknown, confirmation: unknown): password is string {
  return typeof password==='string' && password.length>=12 && password.length<=256 && password===confirmation;
}
export function recoveryFlowId(value: unknown): string | null { return typeof value==='string' && /^[a-f0-9]{32}$/.test(value) ? value : null; }
