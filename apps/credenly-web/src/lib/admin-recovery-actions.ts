"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest } from "@raes/web-core";
import { deploymentMode, siteOrigin } from "@raes/web-core/deployment";
import { enforceWebAdmission } from "@raes/web-core/admission";
import { sendRecovery, acceptRecovery, updateRecoveredPassword, type RecoveryContext } from "@raes/web-core/recovery-server";
import type { RecoveryState } from "@raes/web-core/recovery";
import { createScopedWebAuth } from "./auth";
import { getWebConfig } from "./env";
async function context():Promise<RecoveryContext> {
 const config=getWebConfig(),jar=await cookies(),requestHeaders=await headers();
 const configured=process.env.CREDENLY_ADMISSION_SECRET;
 if(!configured&&deploymentMode(process.env)==='production')throw new Error('Recovery configuration missing');
 return {service:'credenly-web',cookieBase:'credenly-admin-web-auth',site:siteOrigin(process.env,'CREDENLY'),prefix:'/admin',secret:configured??'explicit-local-only-recovery-proof-key',secure:process.env.NODE_ENV==='production',jar,
  auth:()=>createScopedWebAuth('credenly-admin-web-auth-recovery',true),
  admit:(operation,subject)=>enforceWebAdmission('CREDENLY',operation,subject,requestHeaders),
  authorize:async(token,userId)=>{await apiRequest(config.apiBase,'/api/v1/admin/me',{token,validate:(v):v is {data:{id:string}}=>!!v&&typeof v==='object'&&'data'in v&&!!v.data&&typeof v.data==='object'&&'id'in v.data&&v.data.id===userId});},
 };
}
export async function requestRecovery(_state:RecoveryState,form:FormData){return sendRecovery(await context(),form);}
export async function exchangeRecovery(_state:RecoveryState,form:FormData){const result=await acceptRecovery(await context(),form);if(result.redirect)redirect(result.redirect);return result;}
export async function finishRecovery(_state:RecoveryState,form:FormData){return updateRecoveredPassword(await context(),form);}
