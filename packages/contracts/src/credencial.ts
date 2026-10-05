import { z } from "zod";

import {
  categoriaCredencialSchema,
  codigoCortoSchema,
  codigoOrigenSchema,
  fechaHoraIsoSchema,
  fechaIsoSchema,
  sha256Schema,
} from "./common.js";

export const contenidoCredencialSchema = z.object({
  programaCodigoOrigen: codigoCortoSchema.nullable().optional(),
  sedeCodigoOrigen: codigoCortoSchema.nullable().optional(),
  tipo: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Z0-9_-]+$/, "El tipo de credencial debe ser un código en mayúsculas"),
  categoria: categoriaCredencialSchema,
  titulo: z.string().trim().min(2).max(300),
  descripcion: z.string().trim().max(2000).nullable().optional(),
  fechaEmision: fechaIsoSchema,
  fechaGrado: fechaIsoSchema.nullable().optional(),
  numeroActa: z.string().trim().min(1).max(80).nullable().optional(),
  numeroFolio: z.string().trim().min(1).max(80).nullable().optional(),
  numeroLibro: z.string().trim().min(1).max(80).nullable().optional(),
  documentoHashSha256: sha256Schema.nullable().optional(),
});

export const credencialNuevaSchema = contenidoCredencialSchema.extend({
  codigoOrigen: codigoOrigenSchema,
  personaIdentificadorOrigen: codigoOrigenSchema,
});

export const correccionCredencialSchema = z.object({
  codigoOrigen: codigoOrigenSchema,
  motivo: z.string().trim().min(3).max(1000),
  ocurridoAt: fechaHoraIsoSchema,
  datosActualizados: contenidoCredencialSchema,
});

export const revocacionCredencialSchema = z.object({
  codigoOrigen: codigoOrigenSchema,
  motivo: z.string().trim().min(3).max(1000),
  ocurridoAt: fechaHoraIsoSchema,
});

export const anulacionCredencialSchema = z.object({
  codigoOrigen: codigoOrigenSchema,
  motivo: z.string().trim().min(3).max(1000),
  ocurridoAt: fechaHoraIsoSchema,
});

export type ContenidoCredencial = z.infer<typeof contenidoCredencialSchema>;
export type CredencialNueva = z.infer<typeof credencialNuevaSchema>;
export type CorreccionCredencial = z.infer<typeof correccionCredencialSchema>;
export type RevocacionCredencial = z.infer<typeof revocacionCredencialSchema>;
export type AnulacionCredencial = z.infer<typeof anulacionCredencialSchema>;
