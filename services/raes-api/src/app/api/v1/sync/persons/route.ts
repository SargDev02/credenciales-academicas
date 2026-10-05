import { personaSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { syncPerson } from "@/lib/academic-sync";
import { authenticateInstitution } from "@/lib/institution-auth";
import { parseJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const identity = await authenticateInstitution(request, [
      "persons:sync",
    ]);
    const input = await parseJsonBody(request, personaSchema);
    const person = await syncPerson(identity, input);

    return Response.json({
      data: person,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
