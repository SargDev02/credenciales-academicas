import { z } from "zod";

export const codigoOrigenSchema = z
  .string()
  .trim()
  .min(1)
  .max(120);

export const codigoCortoSchema = z
  .string()
  .trim()
  .min(1)
  .max(60);

export const tipoDocumentoSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9_-]+$/, "El tipo de documento debe usar un código en mayúsculas");

export const numeroDocumentoSchema = z
  .string()
  .trim()
  .min(3)
  .max(50);

export const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar formato YYYY-MM-DD");

export const fechaHoraIsoSchema = z
  .string()
  .datetime({ offset: true });

export const sha256Schema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, "Debe ser un hash SHA-256 hexadecimal");

export const estadoInstitucionSchema = z.enum([
  "ACTIVA",
  "INACTIVA",
  "SUSPENDIDA",
]);

export const estadoAcademicoSchema = z.enum([
  "ACTIVO",
  "INACTIVO",
  "SUSPENDIDO",
]);

export const categoriaCredencialSchema = z.enum([
  "TITULO",
  "CURSO",
  "DIPLOMADO",
  "CERTIFICACION",
  "RECONOCIMIENTO",
  "OTRO",
]);

export type EstadoInstitucion = z.infer<typeof estadoInstitucionSchema>;
export type EstadoAcademico = z.infer<typeof estadoAcademicoSchema>;
export type CategoriaCredencial = z.infer<typeof categoriaCredencialSchema>;
