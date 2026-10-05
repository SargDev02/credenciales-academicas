import { z } from "zod";

import {
  codigoCortoSchema,
  estadoInstitucionSchema,
} from "./common.js";

export const sedeSchema = z.object({
  codigoOrigen: codigoCortoSchema,
  nombre: z.string().trim().min(2).max(180),
  departamento: z.string().trim().min(2).max(100).nullable().optional(),
  municipio: z.string().trim().min(2).max(100).nullable().optional(),
  direccion: z.string().trim().min(2).max(220).nullable().optional(),
  estado: estadoInstitucionSchema,
});

export type Sede = z.infer<typeof sedeSchema>;
