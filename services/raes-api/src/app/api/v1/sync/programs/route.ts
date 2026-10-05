import { programaSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { syncProgram } from "@/lib/academic-sync";
import { authenticateInstitution } from "@/lib/institution-auth";
import { parseJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const identity = await authenticateInstitution(request, [
      "institution:sync",
    ]);
    const input = await parseJsonBody(request, programaSchema);
    const program = await syncProgram(identity, input);

    return Response.json({
      data: {
        id: program.id,
        codigoOrigen: program.codigo_origen,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
