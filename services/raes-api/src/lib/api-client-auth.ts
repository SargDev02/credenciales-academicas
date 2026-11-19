import type { ScopeCode } from "./scopes";
import {
  getSecretLookupPrefix,
  parseApiBearer,
  verifyClientSecret,
} from "./api-credentials";
import { getRaesSupabaseAdmin } from "./supabase-admin";

export type ApiClientIdentity = {
  clientDbId: string;
  clientId: string;
  clientName: string;
  clientType: string;
  scopes: ScopeCode[];
};

export class ApiClientAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientAuthError";
  }
}

export async function authenticateApiClient(
  request: Request,
  requiredScopes: ScopeCode[] = [],
): Promise<ApiClientIdentity> {
  const credentials = parseApiBearer(
    request.headers.get("authorization"),
  );

  if (!credentials) {
    throw new ApiClientAuthError(
      401,
      "INVALID_AUTHORIZATION",
      "Credenciales de cliente ausentes o inválidas",
    );
  }

  const supabase = getRaesSupabaseAdmin();

  const { data: clientData, error: clientError } = await supabase
    .from("clientes_api")
    .select("id,nombre,tipo_cliente,client_id,estado")
    .eq("client_id", credentials.clientId)
    .maybeSingle();

  if (clientError) {
    console.error("API client authentication lookup failed", {
      code: clientError.code,
    });

    throw new ApiClientAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar el cliente",
    );
  }

  const client = clientData;

  if (!client || client.estado !== "ACTIVO") {
    throw new ApiClientAuthError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales de cliente inválidas",
    );
  }

  const keyPrefix = getSecretLookupPrefix(credentials.secret);

  const { data: secretData, error: secretError } = await supabase
    .from("cliente_api_secretos")
    .select("id,secret_hash,hash_algorithm,expires_at,revoked_at")
    .eq("cliente_api_id", client.id)
    .eq("key_prefix", keyPrefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (secretError) {
    console.error("API client secret lookup failed", {
      code: secretError.code,
    });

    throw new ApiClientAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar el cliente",
    );
  }

  const secret = secretData;
  const isExpired =
    secret?.expires_at !== null &&
    secret?.expires_at !== undefined &&
    new Date(secret.expires_at).getTime() <= Date.now();

  if (
    !secret ||
    secret.hash_algorithm !== "SHA256" ||
    secret.revoked_at !== null ||
    isExpired ||
    !verifyClientSecret(credentials.secret, secret.secret_hash)
  ) {
    throw new ApiClientAuthError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales de cliente inválidas",
    );
  }

  const { data: scopeLinks, error: scopesError } = await supabase
    .from("cliente_api_scopes")
    .select("scopes!inner(codigo)")
    .eq("cliente_api_id", client.id);

  if (scopesError) {
    console.error("API client scope lookup failed", {
      code: scopesError.code,
    });

    throw new ApiClientAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar los permisos del cliente",
    );
  }

  const scopes = (scopeLinks ?? [])
    .map((row) => {
      const relation = row.scopes as
        | { codigo?: string }
        | { codigo?: string }[]
        | null;

      if (Array.isArray(relation)) {
        return relation[0]?.codigo;
      }

      return relation?.codigo;
    })
    .filter((scope): scope is ScopeCode => typeof scope === "string");

  const missingScope = requiredScopes.find(
    (scope) => !scopes.includes(scope),
  );

  if (missingScope) {
    throw new ApiClientAuthError(
      403,
      "INSUFFICIENT_SCOPE",
      `El cliente no tiene el scope requerido: ${missingScope}`,
    );
  }

  const now = new Date().toISOString();
  const usageUpdates = await Promise.all([
    supabase
      .from("clientes_api")
      .update({ ultimo_uso_at: now })
      .eq("id", client.id),
    supabase
      .from("cliente_api_secretos")
      .update({ last_used_at: now })
      .eq("id", secret.id),
  ]);

  if (usageUpdates.some(({ error }) => error)) {
    console.warn("Could not update API client usage timestamps");
  }

  return {
    clientDbId: client.id,
    clientId: client.client_id,
    clientName: client.nombre,
    clientType: client.tipo_cliente,
    scopes,
  };
}

export function apiClientAuthErrorResponse(
  error: unknown,
): Response {
  if (error instanceof ApiClientAuthError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Unexpected API client authentication error");

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error inesperado",
    },
    { status: 500 },
  );
}
