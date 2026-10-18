import { ApiError, apiErrorResponse } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/request-validation";
import { z } from "zod";

import {
  AdminAuthError,
  adminAuthErrorResponse,
  authenticateAdmin,
} from "@/lib/admin-auth";
import {
  ProvisioningError,
  createApiClient,
  listApiClients,
  provisioningErrorResponse,
} from "@/lib/admin-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiClientCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(160),
  tipoCliente: z.enum([
    "CREDENLY",
    "VERIFICADOR",
    "GOBERNACION",
    "OTRO",
  ]),
  scopes: z
    .array(z.enum(["persons:resolve", "credentials:read"]))
    .min(1),
});

export async function GET(request: Request) {
  try {
    await authenticateAdmin(request, [
      "SUPERADMIN",
      "ADMIN",
      "AUDITOR",
    ]);

    const clients = await listApiClients();

    return Response.json({
      data: clients.map((client) => ({
        id: client.id,
        nombre: client.nombre,
        tipoCliente: client.tipo_cliente,
        clientId: client.client_id,
        estado: client.estado,
        ultimoUsoAt: client.ultimo_uso_at,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    if (error instanceof AdminAuthError) {
      return adminAuthErrorResponse(error);
    }

    if (error instanceof ProvisioningError) {
      return provisioningErrorResponse(error);
    }

    return provisioningErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request, [
      "SUPERADMIN",
      "ADMIN",
    ]);
    const input = await parseJsonBody(request, apiClientCreateSchema);

    const result = await createApiClient(
      input,
      admin.profile.id,
    );

    return Response.json(
      {
        data: {
          client: result.client,
          scopes: result.scopes,
          credentials: result.credentials,
          warning:
            "El clientSecret se entrega una sola vez. RAES conserva únicamente su hash.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos del cliente de API no son válidos",
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
