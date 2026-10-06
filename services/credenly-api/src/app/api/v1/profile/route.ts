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
    return citizenAuthErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const body = await request.json();
    const input = profileInputSchema.parse(body);
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
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos del perfil no son válidos",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    return citizenAuthErrorResponse(error);
  }
}
