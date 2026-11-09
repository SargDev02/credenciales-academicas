import { z } from "zod";
import { personaSchema } from "./persona.js";
import { credencialNuevaSchema } from "./credencial.js";
import { programaSchema } from "./programa.js";
import { sedeSchema } from "./sede.js";
import { programaSedeSchema } from "./programa-sede.js";

export const reviewStateSchema = z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "SUPERSEDIDA"]);
export const reviewTypeSchema = z.enum(["NUEVO_ESTUDIANTE", "ACTUALIZACION_ESTUDIANTE", "NUEVA_CREDENCIAL", "ACTUALIZACION_CREDENCIAL"]);
function nullableFields<T extends Record<string, unknown>>(value: T, keys: string[]): T {
  const normalized: Record<string, unknown> = { ...value };
  for (const key of keys) normalized[key] = value[key] ?? null;
  return normalized as T;
}
const proposedPersonSchema = personaSchema.strict().transform(v => nullableFields(v, ["segundoNombre", "segundoApellido"]));
const observedAt = z.string().datetime({ offset: true }).nullable().default(null);
export const proposedCredentialSchema = z.object({
  identificadorOrigen: z.string().trim().min(1).max(150),
  contenido: credencialNuevaSchema.strict().transform(v => nullableFields(v, ["programaCodigoOrigen", "sedeCodigoOrigen", "descripcion", "fechaGrado", "numeroActa", "numeroFolio", "numeroLibro", "documentoHashSha256"])),
  estado: z.enum(["VIGENTE", "REVOCADA", "ANULADA"]),
  programa: programaSchema.strict().transform(v => nullableFields(v, ["codigoSnies", "nivelFormacion", "modalidad", "facultad"])),
  sede: sedeSchema.strict().transform(v => nullableFields(v, ["departamento", "municipio", "direccion"])),
  relacion: programaSedeSchema.strict().transform(v => nullableFields(v, ["jornada", "modalidad"])),
  sourceUpdatedAt: observedAt,
}).strict().superRefine((v, ctx) => {
  if (v.contenido.programaCodigoOrigen !== v.programa.codigoOrigen ||
      v.contenido.sedeCodigoOrigen !== v.sede.codigoOrigen ||
      v.relacion.programaCodigoOrigen !== v.programa.codigoOrigen ||
      v.relacion.sedeCodigoOrigen !== v.sede.codigoOrigen)
    ctx.addIssue({ code: "custom", message: "Referencias de programa/sede inconsistentes" });
});
export const academicObservationSchema = z.object({
  persona: proposedPersonSchema,
  sourceUpdatedAt: observedAt,
  credenciales: z.array(proposedCredentialSchema).max(50),
}).strict().superRefine((v, ctx) => {
  if (v.credenciales.some(c => c.contenido.personaIdentificadorOrigen !== v.persona.identificadorOrigen) ||
      new Set(v.credenciales.map(c => c.identificadorOrigen)).size !== v.credenciales.length ||
      new Set(v.credenciales.map(c => c.contenido.codigoOrigen)).size !== v.credenciales.length)
    ctx.addIssue({ code: "custom", message: "Identidad o códigos de credenciales inconsistentes" });
});
export const academicDecisionSchema = z.object({ motivo: z.string().trim().min(3).max(1000) }).strict();
export const academicApprovalSchema = z.object({ motivo: z.string().trim().min(3).max(1000).default("Aprobación administrativa de cambio académico") }).strict();
export const reviewFiltersSchema = z.object({
  estado: reviewStateSchema.optional(), tipo: reviewTypeSchema.optional(),
  institucion: z.uuid().optional(), desde: z.iso.date().optional(), hasta: z.iso.date().optional(),
  q: z.string().trim().min(1).max(150).regex(/^[\p{L}\p{N} _.:/-]+$/u).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v => !v.desde || !v.hasta || v.desde <= v.hasta, "Intervalo de fechas inválido");
export const proposalReceiptSchema = z.object({
  data: z.object({ observaciones: z.array(z.object({ id: z.uuid().nullable(), estado: reviewStateSchema.nullable(), nueva: z.boolean() }).strict()).max(51) }).strict(),
}).strict();
export type AcademicObservation = z.infer<typeof academicObservationSchema>;
export type ProposedCredential = z.infer<typeof proposedCredentialSchema>;
export type ReviewFilters = z.infer<typeof reviewFiltersSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

export const detectionLeaseSchema = z.object({ data: z.object({ id: z.uuid(), venceAt: z.string(), estado: z.enum(["EN_CURSO", "COMPLETADA", "ERROR"]) }).strict() }).strict();
export const submitReviewSchema = z.object({ deteccionId: z.uuid(), observacion: academicObservationSchema }).strict();
export const finishDetectionSchema = z.object({ deteccionId: z.uuid(), error: z.boolean().default(false) }).strict();
const institutionReference = z.object({ id: z.uuid(), nombre: z.string().max(200) }).strict();
export const reviewListItemSchema = z.object({
 id: z.uuid(), institucion: institutionReference, tipo: reviewTypeSchema, estado: reviewStateSchema,
 identificadorOrigen: z.string().max(150), personaNombre: z.string().max(250), credencialCodigoOrigen: z.string().nullable(),
 detectadaAt: z.string(), camposModificados: z.array(z.string()).max(64),
}).strict();
export const reviewListResponseSchema = z.object({ data: z.array(reviewListItemSchema).max(100), meta: z.object({ page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100), total: z.number().int().nonnegative() }).strict() }).strict();
export const reviewDetailResponseSchema = z.object({ data: z.object({
 id: z.uuid(), institucion: institutionReference, tipo: reviewTypeSchema, estado: reviewStateSchema,
 identificadorOrigen: z.string(), personaIdentificadorOrigen: z.string(), credencialCodigoOrigen: z.string().nullable(),
 detectadaAt: z.string(), revisadaAt: z.string().nullable(), motivoDecision: z.string().nullable(),
 actual: z.record(z.string(),z.json()), propuesto: z.record(z.string(),z.json()),
 cambios: z.record(z.string(),z.object({ actual: z.json(), propuesto: z.json() }).strict()),
 bloqueos: z.array(z.enum(["ESTADO_TERMINAL","CAMBIO_IDENTIDAD","CANONICO_MODIFICADO"])),
}).strict() }).strict();
export const reviewDecisionResponseSchema = z.object({ data: z.object({ id: z.uuid(), estado: z.enum(["APROBADA", "RECHAZADA"]), recursoRaesId: z.uuid().nullable(), replayed: z.boolean() }).strict() }).strict();
export type AcademicReviewList = z.infer<typeof reviewListResponseSchema>;
export type AcademicReviewDetail = z.infer<typeof reviewDetailResponseSchema>["data"];
