import { z } from "zod";

import {
  codigoCortoSchema,
  estadoAcademicoSchema,
} from "./common.js";

export const programaSedeSchema = z.object({
  programaCodigoOrigen: codigoCortoSchema,
  sedeCodigoOrigen: codigoCortoSchema,
  jornada: z.string().trim().min(1).max(60).nullable().optional(),
  modalidad: z.string().trim().min(1).max(60).nullable().optional(),
  estado: estadoAcademicoSchema,
});

export type ProgramaSede = z.infer<typeof programaSedeSchema>;
