import {
  formatApiBearer,
  generateClientId,
  generateClientSecret,
  getSecretLookupPrefix,
  hashClientSecret,
} from "./api-credentials";
import {
  institutionAScopes,
  type ScopeCode,
} from "./scopes";
import { getRaesSupabaseAdmin } from "./supabase-admin";

export type InstitutionCreateInput = {
  nit: string;
  codigoSnies?: string | null;
  nombre: string;
  tipoInstitucion: string;
  estado: "ACTIVA" | "INACTIVA" | "SUSPENDIDA";
};

export type ApiClientType =
  | "CREDENLY"
  | "VERIFICADOR"
  | "GOBERNACION"
  | "OTRO";

export type ApiClientCreateInput = {
  nombre: string;
  tipoCliente: ApiClientType;
  scopes: ScopeCode[];
};

async function resolveScopes(scopes: ScopeCode[]) {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("scopes")
    .select("id,codigo")
    .in("codigo", scopes);

  if (error) {
    throw new Error(
      `No fue posible consultar scopes: ${error.code}`,
    );
  }

  const missing = scopes.filter(
    (scope) => !data?.some((row) => row.codigo === scope),
  );

  if (missing.length > 0) {
    throw new Error(
      `Scopes no registrados en RAES: ${missing.join(", ")}`,
    );
  }

  return data ?? [];
}

async function writeAudit(input: {
  actorId: string;
  accion: string;
  recursoTipo: string;
  recursoId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getRaesSupabaseAdmin();

  const { error } = await supabase.from("auditoria").insert({
    actor_tipo: "ADMIN",
    actor_id: input.actorId,
    accion: input.accion,
    recurso_tipo: input.recursoTipo,
    recurso_id: input.recursoId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn("Could not write RAES audit record", {
      code: error.code,
      action: input.accion,
    });
  }
}

export async function createInstitution(
  input: InstitutionCreateInput,
  actorId: string,
) {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("instituciones")
    .insert({
      nit: input.nit,
      codigo_snies: input.codigoSnies ?? null,
      nombre: input.nombre,
      tipo_institucion: input.tipoInstitucion,
      estado: input.estado,
    })
    .select(
      "id,nit,codigo_snies,nombre,tipo_institucion,estado,created_at,updated_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ProvisioningError(
        409,
        "INSTITUTION_ALREADY_EXISTS",
        "Ya existe una institución con ese NIT o código SNIES",
      );
    }

    throw new ProvisioningError(
      500,
      "INSTITUTION_CREATE_FAILED",
      "No fue posible crear la institución",
    );
  }

  await writeAudit({
    actorId,
    accion: "INSTITUCION_CREADA",
    recursoTipo: "INSTITUCION",
    recursoId: data.id,
    metadata: {
      nit: data.nit,
      nombre: data.nombre,
    },
  });

  return data;
}

export async function listInstitutions() {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("instituciones")
    .select(
      "id,nit,codigo_snies,nombre,tipo_institucion,estado,created_at,updated_at",
    )
    .order("nombre");

  if (error) {
    throw new ProvisioningError(
      500,
      "INSTITUTION_LIST_FAILED",
      "No fue posible consultar las instituciones",
    );
  }

  return data ?? [];
}

export async function createInstitutionIntegration(
  input: {
    institutionId: string;
    nombre: string;
    scopes?: ScopeCode[];
  },
  actorId: string,
) {
  const supabase = getRaesSupabaseAdmin();
  const scopes = input.scopes ?? institutionAScopes;

  const { data: institution, error: institutionError } = await supabase
    .from("instituciones")
    .select("id,nombre,estado")
    .eq("id", input.institutionId)
    .maybeSingle();

  if (institutionError) {
    throw new ProvisioningError(
      500,
      "INSTITUTION_LOOKUP_FAILED",
      "No fue posible consultar la institución",
    );
  }

  if (!institution) {
    throw new ProvisioningError(
      404,
      "INSTITUTION_NOT_FOUND",
      "La institución no existe",
    );
  }

  const scopeRows = await resolveScopes(scopes);
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const { data: integration, error: integrationError } =
    await supabase
      .from("integraciones_institucionales")
      .insert({
        institucion_id: input.institutionId,
        nombre: input.nombre,
        client_id: clientId,
        estado: "SUSPENDIDA",
      })
      .select("id,institucion_id,nombre,client_id,estado,created_at")
      .single();

  if (integrationError) {
    throw new ProvisioningError(
      500,
      "INTEGRATION_CREATE_FAILED",
      "No fue posible crear la integración institucional",
    );
  }

  const { error: secretError } = await supabase
    .from("integracion_secretos")
    .insert({
      integracion_id: integration.id,
      key_prefix: getSecretLookupPrefix(clientSecret),
      secret_hash: hashClientSecret(clientSecret),
      hash_algorithm: "SHA256",
    });

  if (secretError) {
    throw new ProvisioningError(
      500,
      "INTEGRATION_SECRET_FAILED",
      "No fue posible crear el secreto de la integración",
    );
  }

  const { error: scopeError } = await supabase
    .from("integracion_scopes")
    .insert(
      scopeRows.map((scope) => ({
        integracion_id: integration.id,
        scope_id: scope.id,
      })),
    );

  if (scopeError) {
    throw new ProvisioningError(
      500,
      "INTEGRATION_SCOPE_FAILED",
      "No fue posible asignar permisos a la integración",
    );
  }

  const { data: activeIntegration, error: activateError } =
    await supabase
      .from("integraciones_institucionales")
      .update({ estado: "ACTIVA" })
      .eq("id", integration.id)
      .select("id,institucion_id,nombre,client_id,estado,created_at")
      .single();

  if (activateError) {
    throw new ProvisioningError(
      500,
      "INTEGRATION_ACTIVATION_FAILED",
      "No fue posible activar la integración",
    );
  }

  await writeAudit({
    actorId,
    accion: "INTEGRACION_INSTITUCIONAL_CREADA",
    recursoTipo: "INTEGRACION_INSTITUCIONAL",
    recursoId: integration.id,
    metadata: {
      institutionId: input.institutionId,
      scopes,
    },
  });

  return {
    integration: activeIntegration,
    scopes,
    credentials: {
      clientId,
      clientSecret,
      authorization: formatApiBearer(clientId, clientSecret),
    },
  };
}

export async function createApiClient(
  input: ApiClientCreateInput,
  actorId: string,
) {
  const supabase = getRaesSupabaseAdmin();
  const scopeRows = await resolveScopes(input.scopes);
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const { data: client, error: clientError } = await supabase
    .from("clientes_api")
    .insert({
      nombre: input.nombre,
      tipo_cliente: input.tipoCliente,
      client_id: clientId,
      estado: "SUSPENDIDO",
    })
    .select(
      "id,nombre,tipo_cliente,client_id,estado,created_at,updated_at",
    )
    .single();

  if (clientError) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_CREATE_FAILED",
      "No fue posible crear el cliente de API",
    );
  }

  const { error: secretError } = await supabase
    .from("cliente_api_secretos")
    .insert({
      cliente_api_id: client.id,
      key_prefix: getSecretLookupPrefix(clientSecret),
      secret_hash: hashClientSecret(clientSecret),
      hash_algorithm: "SHA256",
    });

  if (secretError) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_SECRET_FAILED",
      "No fue posible crear el secreto del cliente",
    );
  }

  const { error: scopeError } = await supabase
    .from("cliente_api_scopes")
    .insert(
      scopeRows.map((scope) => ({
        cliente_api_id: client.id,
        scope_id: scope.id,
      })),
    );

  if (scopeError) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_SCOPE_FAILED",
      "No fue posible asignar permisos al cliente",
    );
  }

  const { data: activeClient, error: activateError } =
    await supabase
      .from("clientes_api")
      .update({ estado: "ACTIVO" })
      .eq("id", client.id)
      .select(
        "id,nombre,tipo_cliente,client_id,estado,created_at,updated_at",
      )
      .single();

  if (activateError) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_ACTIVATION_FAILED",
      "No fue posible activar el cliente",
    );
  }

  await writeAudit({
    actorId,
    accion: "CLIENTE_API_CREADO",
    recursoTipo: "CLIENTE_API",
    recursoId: client.id,
    metadata: {
      tipoCliente: input.tipoCliente,
      scopes: input.scopes,
    },
  });

  return {
    client: activeClient,
    scopes: input.scopes,
    credentials: {
      clientId,
      clientSecret,
      authorization: formatApiBearer(clientId, clientSecret),
    },
  };
}

export async function listApiClients() {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("clientes_api")
    .select(
      "id,nombre,tipo_cliente,client_id,estado,ultimo_uso_at,created_at,updated_at",
    )
    .order("nombre");

  if (error) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_LIST_FAILED",
      "No fue posible consultar los clientes de API",
    );
  }

  return data ?? [];
}

export class ProvisioningError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export function provisioningErrorResponse(
  error: unknown,
): Response {
  if (error instanceof ProvisioningError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Unexpected RAES provisioning error", {
    message: error instanceof Error ? error.message : "unknown error",
  });

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error inesperado",
    },
    { status: 500 },
  );
}
