import { z } from "zod";

import {
  ApiClientAuthError,
  apiClientAuthErrorResponse,
  authenticateApiClient,
} from "@/lib/api-client-auth";
import {
  ConsumerReadError,
  consumerReadErrorResponse,
  resolvePersonByDocument,
} from "@/lib/consumer-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resolvePersonSchema = z.object({
  tipoDocumento: z.string().trim().min(1).max(20),
  numeroDocumento: z.string().trim().min(3).max(40),
});

export async function POST(request: Request) {
  try {
    await authenticateApiClient(request, ["persons:resolve"]);

    const body = await request.json();
    const input = resolvePersonSchema.parse(body);

    const person = await resolvePersonByDocument({
      tipoDocumento: input.tipoDocumento.toUpperCase(),
      numeroDocumento: input.numeroDocumento,
    });

    return Response.json({
      data: {
        id: person.id,
        tipoDocumento: person.tipo_documento,
        numeroDocumento: person.numero_documento,
        primerNombre: person.primer_nombre,
        segundoNombre: person.segundo_nombre,
        primerApellido: person.primer_apellido,
        segundoApellido: person.segundo_apellido,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "La identidad enviada no es válida",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof ApiClientAuthError) {
      return apiClientAuthErrorResponse(error);
    }

    if (error instanceof ConsumerReadError) {
      return consumerReadErrorResponse(error);
    }

    return consumerReadErrorResponse(error);
  }
}
