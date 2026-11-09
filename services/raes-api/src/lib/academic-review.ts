import { z, type ZodType } from "zod";
import {
  academicApprovalSchema, academicDecisionSchema, finishDetectionSchema,
  detectionLeaseSchema, submitReviewSchema, proposalReceiptSchema,
  reviewFiltersSchema, reviewListResponseSchema, reviewDetailResponseSchema,
  reviewDecisionResponseSchema,
} from "@raes/contracts";
import { AdminAuthError, authenticateAdmin, adminAuthErrorResponse } from "./admin-auth";
import { parseApiBearer } from "./api-credentials";
import { authenticateInstitution } from "./institution-auth";
import { ApiError, apiErrorResponse } from "./api-error";
import { parseJsonBody } from "./request-validation";
import { getRaesSupabaseAdmin } from "./supabase-admin";

export function privateReviewResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function reviewErrorResponse(error: unknown): Response {
  const response = error instanceof AdminAuthError ? adminAuthErrorResponse(error) : apiErrorResponse(error);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function reviewRpc<T>(name: string, args: Record<string, unknown>, schema: ZodType<T>): Promise<T> {
  const { data, error } = await getRaesSupabaseAdmin().rpc(name, args);
  if (error) {
    const message = error.message ?? "";
    if (message.includes("REVIEW_FORBIDDEN")) throw new ApiError(403, "REVIEW_FORBIDDEN", "Tu rol no permite esta operación");
    if (message.includes("REVIEW_NOT_FOUND")) throw new ApiError(404, "REVIEW_NOT_FOUND", "La solicitud no está disponible");
    const conflicts = ["SOURCE_IDENTITY_CONFLICT", "BASELINE_REQUIRED", "DETECTION_RUNNING", "DETECTION_EXPIRED", "SOURCE_STALE", "STALE", "CANONICAL_CHANGED", "TERMINAL_BLOCKED", "IDENTITY_CHANGE_BLOCKED", "PERSON_REQUIRED", "INVALID_INTEGRATION"];
    const conflict = conflicts.find(code => message.includes(`REVIEW_${code}`));
    if (conflict) throw new ApiError(409, `REVIEW_${conflict}`, {
      SOURCE_IDENTITY_CONFLICT: "El identificador de origen no puede reasignarse a otra credencial",
      BASELINE_REQUIRED: "Falta completar el baseline de la institución",
      DETECTION_RUNNING: "Ya existe una detección en curso para esta institución",
      DETECTION_EXPIRED: "La detección expiró; inicia una nueva ejecución",
      SOURCE_STALE: "La observación es anterior al último dato recibido",
      STALE: "La solicitud ya fue revisada o fue supersedida",
      CANONICAL_CHANGED: "El registro oficial cambió. Se requiere una nueva detección y revisión",
      TERMINAL_BLOCKED: "REQUIERE_DECISION: el dominio no permite reactivar o corregir un estado terminal",
      IDENTITY_CHANGE_BLOCKED: "REQUIERE_DECISION: no se permite reasignar una identidad existente",
      PERSON_REQUIRED: "La persona asociada requiere una incorporación académica agrupada",
      INVALID_INTEGRATION: "La integración institucional no está activa",
    }[conflict] ?? "La revisión entra en conflicto con el estado actual");
    if (message.includes("REVIEW_INVALID")) throw new ApiError(400, "REVIEW_INVALID_REQUEST", "Revisa los datos de la solicitud");
    // Do not reflect SQL, PostgREST details, payloads or integration credentials.
    throw new ApiError(503, "REVIEW_UNAVAILABLE", "No fue posible completar la revisión académica");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(503, "REVIEW_INVALID_RESPONSE", "El servicio no devolvió una respuesta válida");
  return parsed.data;
}

async function authenticateReviewAdmin(request: Request, readOnly = false) {
  if (parseApiBearer(request.headers.get("authorization"))) {
    await authenticateInstitution(request);
    throw new ApiError(403, "REVIEW_FORBIDDEN", "Una institución no puede revisar ni decidir sus propias propuestas");
  }
  return readOnly ? authenticateAdmin(request,["SUPERADMIN","ADMIN","AUDITOR"]) : authenticateAdmin(request);
}

export async function submitAcademicReview(request: Request): Promise<Response> {
  try {
    const identity = await authenticateInstitution(request, ["academic-review:submit"]);
    const input = await parseJsonBody(request, submitReviewSchema);
    const data = await reviewRpc("presentar_revision_academica", { p_integracion_id: identity.integrationId, p_deteccion_id: input.deteccionId, p_observacion: input.observacion }, proposalReceiptSchema.shape.data);
    return privateReviewResponse({ data });
  } catch (error) { return reviewErrorResponse(error); }
}
export async function controlDetection(request: Request, finish = false): Promise<Response> {
  try {
    const identity = await authenticateInstitution(request, ["academic-review:submit"]);
    const input = finish ? await parseJsonBody(request, finishDetectionSchema) : null;
    const data = await reviewRpc("controlar_deteccion_academica", { p_integracion_id: identity.integrationId, p_accion: finish ? "FINALIZAR" : "INICIAR", p_deteccion_id: input?.deteccionId ?? null, p_error: input?.error ?? false }, detectionLeaseSchema.shape.data);
    return privateReviewResponse({ data });
  } catch (error) { return reviewErrorResponse(error); }
}
export async function listAcademicReviews(request: Request): Promise<Response> {
  try {
    const admin = await authenticateReviewAdmin(request, true);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(k => url.searchParams.getAll(k).length !== 1)) throw new ApiError(400, "INVALID_FILTERS", "No repitas parámetros de consulta");
    const parsed = reviewFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ApiError(400, "INVALID_FILTERS", "Revisa los filtros y la paginación");
    return privateReviewResponse(await reviewRpc("listar_revisiones_academicas", { p_admin_id: admin.profile.id, p_filtros: parsed.data }, reviewListResponseSchema));
  } catch (error) { return reviewErrorResponse(error); }
}
export async function readAcademicReview(request: Request, id: string): Promise<Response> {
  try {
    const admin = await authenticateReviewAdmin(request, true);
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "REVIEW_NOT_FOUND", "La solicitud no está disponible");
    return privateReviewResponse(await reviewRpc("obtener_revision_academica", { p_admin_id: admin.profile.id, p_solicitud_id: id }, reviewDetailResponseSchema));
  } catch (error) { return reviewErrorResponse(error); }
}
export async function decideAcademicReview(request: Request, id: string, action: "APROBAR" | "RECHAZAR"): Promise<Response> {
  try {
    const admin = await authenticateReviewAdmin(request);
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "REVIEW_NOT_FOUND", "La solicitud no está disponible");
    const input = await parseJsonBody(request, action === "APROBAR" ? academicApprovalSchema : academicDecisionSchema);
    const data = await reviewRpc("decidir_revision_academica", { p_admin_id: admin.profile.id, p_solicitud_id: id, p_accion: action, p_motivo: input.motivo }, reviewDecisionResponseSchema.shape.data);
    return privateReviewResponse({ data });
  } catch (error) { return reviewErrorResponse(error); }
}
export async function retiredInstitutionalWrite(request: Request): Promise<Response> {
  try {
    await authenticateInstitution(request);
    return privateReviewResponse({ error: "ACADEMIC_REVIEW_REQUIRED", message: "Los cambios institucionales requieren una propuesta y aprobación administrativa" }, 409);
  } catch (error) { return reviewErrorResponse(error); }
}
