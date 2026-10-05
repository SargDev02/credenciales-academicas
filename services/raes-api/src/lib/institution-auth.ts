import type { ScopeCode } from "./scopes";
import {
  getSecretLookupPrefix,
  parseInstitutionBearer,
  verifyClientSecret,
} from "./api-credentials";
import { getRaesSupabaseAdmin } from "./supabase-admin";

export type InstitutionalIdentity = {
  integrationId: string;
  institutionId: string;
  clientId: string;
  integrationName: string;
  scopes: ScopeCode[];
};

export class InstitutionalAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InstitutionalAuthError";
  }
}

type IntegrationRow = {
  id: string;
  institucion_id: string;
  nombre: string;
  client_id: string;
  estado: string;
};

type SecretRow = {
  id: string;
  secret_hash: string;
  hash_algorithm: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function authenticateInstitution(
  request: Request,
  requiredScopes: ScopeCode[] = [],
): Promise<InstitutionalIdentity> {
  const credentials = parseInstitutionBearer(
    request.headers.get("authorization"),
  );

  if (!credentials) {
    throw new InstitutionalAuthError(
      401,
      "INVALID_AUTHORIZATION",
      "Credenciales institucionales ausentes o inválidas",
    );
  }

  const supabase = getRaesSupabaseAdmin();

  const { data: integrationData, error: integrationError } = await supabase
    .from("integraciones_institucionales")
    .select("id,institucion_id,nombre,client_id,estado")
    .eq("client_id", credentials.clientId)
    .maybeSingle();

  if (integrationError) {
    console.error("Institutional authentication lookup failed", {
      code: integrationError.code,
    });

    throw new InstitutionalAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar la integración",
    );
  }

  const integration = integrationData as IntegrationRow | null;

  if (!integration || integration.estado !== "ACTIVA") {
    throw new InstitutionalAuthError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales institucionales inválidas",
    );
  }

  const keyPrefix = getSecretLookupPrefix(credentials.secret);

  const { data: secretData, error: secretError } = await supabase
    .from("integracion_secretos")
    .select(
      "id,secret_hash,hash_algorithm,expires_at,revoked_at",
    )
    .eq("integracion_id", integration.id)
    .eq("key_prefix", keyPrefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (secretError) {
    console.error("Institutional secret lookup failed", {
      code: secretError.code,
    });

    throw new InstitutionalAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar la integración",
    );
  }

  const secret = secretData as SecretRow | null;
  const isExpired =
    secret?.expires_at !== null &&
    secret?.expires_at !== undefined &&
    new Date(secret.expires_at).getTime() <= Date.now();

  if (
    !secret ||
    secret.hash_algorithm !== "SHA256" ||
    isExpired ||
    !verifyClientSecret(credentials.secret, secret.secret_hash)
  ) {
    throw new InstitutionalAuthError(
      401,
      "INVALID_CREDENTIALS",
      "Credenciales institucionales inválidas",
    );
  }

  const { data: scopeLinks, error: scopesError } = await supabase
    .from("integracion_scopes")
    .select("scopes!inner(codigo)")
    .eq("integracion_id", integration.id);

  if (scopesError) {
    console.error("Institutional scope lookup failed", {
      code: scopesError.code,
    });

    throw new InstitutionalAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar los permisos de la integración",
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
    throw new InstitutionalAuthError(
      403,
      "INSUFFICIENT_SCOPE",
      `La integración no tiene el scope requerido: ${missingScope}`,
    );
  }

  const now = new Date().toISOString();

  const usageUpdates = await Promise.all([
    supabase
      .from("integraciones_institucionales")
      .update({ ultimo_uso_at: now })
      .eq("id", integration.id),
    supabase
      .from("integracion_secretos")
      .update({ last_used_at: now })
      .eq("id", secret.id),
  ]);

  if (usageUpdates.some(({ error }) => error)) {
    console.warn("Could not update integration usage timestamps");
  }

  return {
    integrationId: integration.id,
    institutionId: integration.institucion_id,
    clientId: integration.client_id,
    integrationName: integration.nombre,
    scopes,
  };
}

export function institutionalAuthErrorResponse(
  error: unknown,
): Response {
  if (error instanceof InstitutionalAuthError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Unexpected institutional authentication error");

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error inesperado",
    },
    { status: 500 },
  );
}
