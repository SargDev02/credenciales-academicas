import { z } from "zod";

import {
  AdminAuthError,
  adminAuthErrorResponse,
  authenticateAdmin,
} from "@/lib/admin-auth";
import {
  ProvisioningError,
  createInstitution,
  listInstitutions,
  provisioningErrorResponse,
} from "@/lib/admin-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const institutionCreateSchema = z.object({
  nit: z.string().trim().min(3).max(40),
  codigoSnies: z.string().trim().min(1).max(40).nullable().optional(),
  nombre: z.string().trim().min(2).max(200),
  tipoInstitucion: z.string().trim().min(2).max(80),
  estado: z
    .enum(["ACTIVA", "INACTIVA", "SUSPENDIDA"])
    .default("ACTIVA"),
});

export async function GET(request: Request) {
  try {
    await authenticateAdmin(request, [
      "SUPERADMIN",
      "ADMIN",
      "AUDITOR",
    ]);

    const institutions = await listInstitutions();

    return Response.json({
      data: institutions.map((institution) => ({
        id: institution.id,
        nit: institution.nit,
        codigoSnies: institution.codigo_snies,
        nombre: institution.nombre,
        tipoInstitucion: institution.tipo_institucion,
        estado: institution.estado,
        createdAt: institution.created_at,
        updatedAt: institution.updated_at,
      })),
    });
  } catch (error) {
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
    const body = await request.json();
    const input = institutionCreateSchema.parse(body);

    const institution = await createInstitution(
      {
        nit: input.nit,
        nombre: input.nombre,
        tipoInstitucion: input.tipoInstitucion,
        estado: input.estado,
        ...(input.codigoSnies !== undefined
          ? { codigoSnies: input.codigoSnies }
          : {}),
      },
      admin.profile.id,
    );

    return Response.json(
      {
        data: {
          id: institution.id,
          nit: institution.nit,
          codigoSnies: institution.codigo_snies,
          nombre: institution.nombre,
          tipoInstitucion: institution.tipo_institucion,
          estado: institution.estado,
          createdAt: institution.created_at,
          updatedAt: institution.updated_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de la institución no son válidos",
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
