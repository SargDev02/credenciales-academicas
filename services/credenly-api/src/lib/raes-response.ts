import { z } from "zod";
import type { RaesCredential, RaesPerson, RaesClientIdentity } from "./raes-client";
const text = z.string().max(4000);
const id = z.string().min(1).max(200);
const nullableText = text.nullable();
export const raesPersonResponse: z.ZodType<RaesPerson> = z.object({
  id, tipoDocumento: id, numeroDocumento: id, primerNombre: text,
  segundoNombre: nullableText, primerApellido: text, segundoApellido: nullableText,
});
export const raesIdentityResponse: z.ZodType<RaesClientIdentity> = z.object({
  id, clientId: id, nombre: text, tipoCliente: id, scopes: z.array(id).max(100),
});
export const raesCredentialsResponse: z.ZodType<RaesCredential[]> = z.array(z.object({
  id, codigoRaes: id, tipo: id, categoria: id,
  estadoActual: z.enum(["VIGENTE", "REVOCADA", "ANULADA"]),
  versionActual: z.number().int().positive(), fechaRegistroRaes: text,
  revocadaAt: nullableText, motivoRevocacion: nullableText,
  anuladaAt: nullableText, motivoAnulacion: nullableText,
  institucion: z.object({ id, nit: id, nombre: text }).nullable(),
  programa: z.object({ id, nombre: text, codigo_snies: nullableText }).nullable(),
  sede: z.object({ id, nombre: text, municipio: nullableText }).nullable(),
  version: z.object({
    numeroVersion: z.number().int().positive(), tipo: id, categoria: id,
    titulo: text, descripcion: nullableText, fechaEmision: text,
    fechaGrado: nullableText, estadoReportado: id, numeroActa: nullableText,
    numeroFolio: nullableText, numeroLibro: nullableText, createdAt: text,
  }).nullable(),
})).max(10000);
