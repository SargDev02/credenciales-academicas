import { z } from "zod";

import {
  ApiClientAuthError,
  apiClientAuthErrorResponse,
  authenticateApiClient,
  type ApiClientIdentity,
} from "./api-client-auth";
import { auditApiClientOperation, type ClientOperation } from "./api-client-audit";
import { consumerReadErrorResponse } from "./consumer-read";
import type { ScopeCode } from "./scopes";

export async function auditedClientOperation(
  request: Request,
  operation: ClientOperation,
  requiredScope: ScopeCode,
  execute: () => Promise<{ response: Response; resourceId: string }>,
): Promise<Response> {
  let client: ApiClientIdentity | undefined;
  let resourceId: string | undefined;
  let response: Response;

  try {
    // Authenticate before authorizing, so a scope denial has a verified actor.
    client = await authenticateApiClient(request);
    if (!client.scopes.includes(requiredScope)) {
      throw new ApiClientAuthError(403, "INSUFFICIENT_SCOPE",
        `El cliente no tiene el scope requerido: ${requiredScope}`);
    }
    const result = await execute();
    response = result.response;
    resourceId = result.resourceId;
  } catch (error) {
    if (error instanceof ApiClientAuthError) {
      response = apiClientAuthErrorResponse(error);
    } else if (error instanceof z.ZodError || error instanceof SyntaxError) {
      response = Response.json({
        error: "VALIDATION_ERROR", message: "La solicitud enviada no es válida",
      }, { status: 400 });
    } else {
      response = consumerReadErrorResponse(error);
    }
  }

  // An unverified Bearer value must never be attributed to a real client.
  if (client) {
    try {
      await auditApiClientOperation({
        client, operation, status: response.status,
        ...(resourceId ? { resourceId } : {}),
      });
    } catch {
      console.error("RAES API client audit unavailable", { operation });
      return Response.json({
        error: "AUDIT_UNAVAILABLE",
        message: "No fue posible registrar la operación; intenta nuevamente",
      }, { status: 503 });
    }
  }
  return response;
}
