import { z } from "zod";
import { parseJsonBody } from "@/lib/request-validation";

import { auditedClientOperation } from "@/lib/audited-client-operation";
import { resolvePersonByDocument } from "@/lib/consumer-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resolvePersonSchema = z.object({
  tipoDocumento: z.string().trim().min(1).max(20),
  numeroDocumento: z.string().trim().min(3).max(40),
});

export async function POST(request: Request) {
  return auditedClientOperation(request, "PERSON_RESOLVE", "persons:resolve", async () => {
    const input = await parseJsonBody(request, resolvePersonSchema);

    const person = await resolvePersonByDocument({
      tipoDocumento: input.tipoDocumento.toUpperCase(),
      numeroDocumento: input.numeroDocumento,
    });

    return {
      resourceId: person.id,
      response: Response.json({
        data: {
          id: person.id,
          tipoDocumento: person.tipo_documento,
          numeroDocumento: person.numero_documento,
          primerNombre: person.primer_nombre,
          segundoNombre: person.segundo_nombre,
          primerApellido: person.primer_apellido,
          segundoApellido: person.segundo_apellido,
        },
      }),
    };
  });
}
