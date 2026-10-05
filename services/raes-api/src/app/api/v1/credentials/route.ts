import { credencialNuevaSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { registerInitialCredential } from "@/lib/credential-registration";
import {
  getMutationRequestContext,
  hashMutationRequest,
} from "@/lib/idempotency";
import { authenticateInstitution } from "@/lib/institution-auth";
import { parseJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const identity = await authenticateInstitution(request, [
      "credentials:create",
    ]);
    const context = getMutationRequestContext(request);
    const input = await parseJsonBody(
      request,
      credencialNuevaSchema,
    );
    const requestHash = hashMutationRequest(
      "CREDENTIAL_CREATE",
      input,
    );

    const result = await registerInitialCredential(
      identity,
      context,
      requestHash,
      input,
    );

    return Response.json(
      {
        data: {
          id: result.credentialId,
          codigoRaes: result.codigoRaes,
          codigoOrigen: input.codigoOrigen,
          estado: "VIGENTE",
          version: result.version,
        },
        meta: {
          operationId: result.operationId,
          replayed: result.replayed,
        },
      },
      {
        status: 201,
        headers: {
          "X-Request-Id": context.requestId,
          "Idempotency-Replayed": result.replayed
            ? "true"
            : "false",
        },
      },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
