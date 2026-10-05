import { z } from "zod";

import {
  codigoOrigenSchema,
  numeroDocumentoSchema,
  tipoDocumentoSchema,
} from "./common.js";

export const personaSchema = z.object({
  identificadorOrigen: codigoOrigenSchema,
  tipoDocumento: tipoDocumentoSchema,
  numeroDocumento: numeroDocumentoSchema,
  primerNombre: z.string().trim().min(1).max(100),
  segundoNombre: z.string().trim().min(1).max(100).nullable().optional(),
  primerApellido: z.string().trim().min(1).max(100),
  segundoApellido: z.string().trim().min(1).max(100).nullable().optional(),
});

export type Persona = z.infer<typeof personaSchema>;
