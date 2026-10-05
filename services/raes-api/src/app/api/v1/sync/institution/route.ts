import { institucionSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { syncInstitution } from "@/lib/academic-sync";
import { authenticateInstitution } from "@/lib/institution-auth";
import { parseJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const identity = await authenticateInstitution(request, [
      "institution:sync",
    ]);
    const input = await parseJsonBody(request, institucionSchema);
    const institution = await syncInstitution(identity, input);

    return Response.json({
      data: {
        id: institution.id,
        nit: institution.nit,
        codigoSnies: institution.codigo_snies,
        nombre: institution.nombre,
        tipoInstitucion: institution.tipo_institucion,
        estado: institution.estado,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
