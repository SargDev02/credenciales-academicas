import { revocacionCredencialSchema } from "@raes/contracts";

import { apiErrorResponse } from "@/lib/api-error";
import { revokeCredential } from "@/lib/credential-lifecycle";
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
      "credentials:revoke",
    ]);
    const context = getMutationRequestContext(request);
    const input = await parseJsonBody(
      request,
      revocacionCredencialSchema,
    );
    const requestHash = hashMutationRequest(
      "CREDENTIAL_REVOKE",
      input,
    );

    const result = await revokeCredential(
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
          estado: result.estado,
          version: result.version,
        },
        meta: {
          operationId: result.operationId,
          replayed: result.replayed,
        },
      },
      {
        status: 200,
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
