import type { ApiClientIdentity } from "./api-client-auth";
import { getRaesSupabaseAdmin } from "./supabase-admin";

export type ClientOperation = "PERSON_RESOLVE" | "CREDENTIALS_READ";

const endpoints: Record<ClientOperation, string> = {
  PERSON_RESOLVE: "POST /api/v1/persons/resolve",
  CREDENTIALS_READ: "GET /api/v1/persons/{personId}/credentials",
};

// Only allowlisted metadata reaches storage; never accept Request, body or errors.
export async function auditApiClientOperation(input: {
  client: ApiClientIdentity;
  operation: ClientOperation;
  status: number;
  resourceId?: string;
}): Promise<void> {
  const result = input.status < 400 ? "OK"
    : input.status === 403 ? "DENEGADO"
    : input.status === 404 ? "NO_ENCONTRADO"
    : input.status === 400 ? "ERROR_VALIDACION"
    : "ERROR";

  const { error } = await getRaesSupabaseAdmin().from("auditoria").insert({
    actor_tipo: "CLIENTE_API",
    actor_id: input.client.clientDbId,
    accion: input.operation,
    recurso_tipo: "PERSONA",
    recurso_id: input.resourceId ?? null,
    metadata: {
      endpoint: endpoints[input.operation],
      resultado: result,
      http_status: input.status,
    },
  });

  if (error) {
    // PostgREST details can contain rejected rows. Do not log the error object.
    throw new Error("AUDIT_WRITE_FAILED");
  }
}
