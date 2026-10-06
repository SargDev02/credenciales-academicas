import { z } from "zod";

import {
  AdminAuthError,
  adminAuthErrorResponse,
  authenticateAdmin,
} from "@/lib/admin-auth";
import {
  ProvisioningError,
  createInstitutionIntegration,
  provisioningErrorResponse,
} from "@/lib/admin-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const integrationCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(160),
  scopes: z
    .array(
      z.enum([
        "institution:sync",
        "persons:sync",
        "credentials:create",
        "credentials:correct",
        "credentials:revoke",
        "credentials:annul",
      ]),
    )
    .min(1)
    .optional(),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{ institutionId: string }>;
  },
) {
  try {
    const admin = await authenticateAdmin(request, [
      "SUPERADMIN",
      "ADMIN",
    ]);
    const { institutionId } = await context.params;
    const body = await request.json();
    const input = integrationCreateSchema.parse(body);

    const result = await createInstitutionIntegration(
      {
        institutionId,
        nombre: input.nombre,
        ...(input.scopes ? { scopes: input.scopes } : {}),
      },
      admin.profile.id,
    );

    return Response.json(
      {
        data: {
          integration: result.integration,
          scopes: result.scopes,
          credentials: result.credentials,
          warning:
            "El clientSecret se entrega una sola vez. RAES conserva únicamente su hash.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de la integración no son válidos",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof AdminAuthError) {
      return adminAuthErrorResponse(error);
    }

    if (error instanceof ProvisioningError) {
      return provisioningErrorResponse(error);
    }

    return provisioningErrorResponse(error);
  }
}
