import { parseJsonBody, requestValidationErrorResponse } from "@/lib/request-validation";
import { z } from "zod";

import {
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  getProfile,
  profileInputSchema,
  upsertProfile,
} from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const profile = await getProfile(user.id);

    return Response.json({
      data: profile
        ? {
            id: profile.id,
            nombres: profile.nombres,
            apellidos: profile.apellidos,
            estado: profile.estado,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          }
        : null,
    });
  } catch (error) {
    const validation = requestValidationErrorResponse(error);
    if (validation) return validation;
    return citizenAuthErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const input = await parseJsonBody(request, profileInputSchema);
    const profile = await upsertProfile(user.id, input);

    return Response.json({
      data: {
        id: profile.id,
        nombres: profile.nombres,
        apellidos: profile.apellidos,
        estado: profile.estado,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
  } catch (error) {
    const validation = requestValidationErrorResponse(error);
    if (validation) return validation;
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos del perfil no son válidos",
        },
        { status: 400 },
      );
    }

    return citizenAuthErrorResponse(error);
  }
}
