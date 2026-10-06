import { z } from "zod";

import {
  CitizenAuthError,
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  RaesLinkError,
  getRaesLinkForUser,
  linkApprovedVerificationToRaes,
  raesIntegrationErrorResponse,
} from "@/lib/raes-link";
import { RaesClientError } from "@/lib/raes-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const linkInputSchema = z.object({
  verificacionIdentidadId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const link = await getRaesLinkForUser(user.id);

    return Response.json({
      data: link
        ? {
            id: link.id,
            raesPersonaId: link.raes_persona_id,
            verificacionIdentidadId:
              link.verificacion_identidad_id,
            estado: link.estado,
            metodoVerificacion: link.metodo_verificacion,
            verifiedAt: link.verified_at,
            createdAt: link.created_at,
            updatedAt: link.updated_at,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    return raesIntegrationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const body = await request.json();
    const input = linkInputSchema.parse(body);

    const link = await linkApprovedVerificationToRaes(
      user.id,
      input.verificacionIdentidadId,
    );

    return Response.json({
      data: {
        id: link.id,
        raesPersonaId: link.raes_persona_id,
        verificacionIdentidadId:
          link.verificacion_identidad_id,
        estado: link.estado,
        metodoVerificacion: link.metodo_verificacion,
        verifiedAt: link.verified_at,
        createdAt: link.created_at,
        updatedAt: link.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message:
            "La solicitud de vinculación no es válida",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    if (
      error instanceof RaesLinkError ||
      error instanceof RaesClientError
    ) {
      return raesIntegrationErrorResponse(error);
    }

    return raesIntegrationErrorResponse(error);
  }
}
