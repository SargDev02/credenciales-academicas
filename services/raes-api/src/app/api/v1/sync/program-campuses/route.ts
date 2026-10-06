import { programaSedeSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { syncProgramCampus } from "@/lib/academic-sync";
import { authenticateInstitution } from "@/lib/institution-auth";
import { parseJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const identity = await authenticateInstitution(request, [
      "institution:sync",
    ]);
    const input = await parseJsonBody(request, programaSedeSchema);
    const relation = await syncProgramCampus(identity, input);

    return Response.json({
      data: {
        id: relation.id,
        programaCodigoOrigen: input.programaCodigoOrigen,
        sedeCodigoOrigen: input.sedeCodigoOrigen,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
