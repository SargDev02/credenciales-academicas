"use server";
import { revalidatePath } from "next/cache";
import { apiRequest, WebApiError } from "@raes/web-core";
import { academicDecisionSchema, academicApprovalSchema, reviewDecisionResponseSchema } from "@raes/contracts";
import { requireSession } from "./auth";
import { getAdminProfile } from "./admin-api";
import { canManage } from "./admin-model";
import { getWebConfig } from "./env";
export type ReviewActionResult = {error?:string;status?:number;message?:string};
export async function decideReview(id:string,action:"approve"|"reject",reason:string): Promise<ReviewActionResult> {
 try {
  const {token}=await requireSession();
  if(!canManage(await getAdminProfile()))return {error:"Tu rol permite únicamente consultar las validaciones.",status:403};
  if(!/^[0-9a-f-]{36}$/i.test(id)||!["approve","reject"].includes(action))return {error:"Solicitud no válida.",status:400};
  const body=(action==="reject"?academicDecisionSchema:academicApprovalSchema).safeParse({motivo:reason});
  if(!body.success)return {error:"Escribe un motivo de entre 3 y 1000 caracteres.",status:400};
  const result=await apiRequest(getWebConfig().apiBase,`/api/v1/admin/academic-reviews/${id}/${action}`,{token,method:"POST",body:body.data,validate:(v):v is ReturnType<typeof reviewDecisionResponseSchema.parse>=>reviewDecisionResponseSchema.safeParse(v).success});
  revalidatePath("/validations");revalidatePath(`/validations/${id}`);revalidatePath("/dashboard");
  return {message:result.data.replayed?"La decisión ya estaba registrada; no se aplicó dos veces.":action==="approve"?"Solicitud aprobada. El cambio ya está disponible en el registro oficial RAES.":"Solicitud rechazada. El registro oficial permanece intacto."};
 }catch(error){
  if(error instanceof WebApiError)return {status:error.status,error:error.status===409?"La solicitud cambió o el dominio bloquea esta transición. Actualiza la revisión antes de continuar.":error.status===404?"La solicitud ya no está disponible.":error.message};
  return {error:"No pudimos confirmar la decisión. Actualiza el estado antes de reintentar."};
 }
}
