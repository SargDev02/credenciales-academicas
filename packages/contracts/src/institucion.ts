import { z } from "zod";

import { estadoInstitucionSchema } from "./common.js";

export const institucionSchema = z.object({
  nit: z.string().trim().min(3).max(20),
  codigoSnies: z.string().trim().min(1).max(30).nullable().optional(),
  nombre: z.string().trim().min(2).max(200),
  tipoInstitucion: z.string().trim().min(2).max(100),
  estado: estadoInstitucionSchema,
});

export type Institucion = z.infer<typeof institucionSchema>;
