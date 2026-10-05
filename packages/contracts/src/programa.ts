import { z } from "zod";

import {
  codigoCortoSchema,
  estadoAcademicoSchema,
} from "./common.js";

export const programaSchema = z.object({
  codigoOrigen: codigoCortoSchema,
  codigoSnies: z.string().trim().min(1).max(30).nullable().optional(),
  nombre: z.string().trim().min(2).max(220),
  nivelFormacion: z.string().trim().min(2).max(100).nullable().optional(),
  modalidad: z.string().trim().min(2).max(60).nullable().optional(),
  facultad: z.string().trim().min(2).max(180).nullable().optional(),
  estado: estadoAcademicoSchema,
});

export type Programa = z.infer<typeof programaSchema>;
