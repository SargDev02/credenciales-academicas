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

  const { data, error, count } = await supabase
    .from("instituciones")
    .select(
      "id,nit,codigo_snies,nombre,tipo_institucion,estado,created_at,updated_at",
      { count: "exact" },
    )
    .order("nombre")
    .limit(1000);

  if (error) {
    throw new ProvisioningError(
      500,
      "INSTITUTION_LIST_FAILED",
      "No fue posible consultar las instituciones",
    );
  }

  if (count === null || count !== (data?.length ?? 0)) {
    throw new ProvisioningError(503, "LIST_LIMIT_EXCEEDED", "La consulta requiere paginación antes de poder devolver un listado completo");
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
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const { data, error } = await supabase.rpc(
    "aprovisionar_integracion_institucional",
    {
      p_institucion_id: input.institutionId,
      p_nombre: input.nombre,
      p_client_id: clientId,
      p_key_prefix: getSecretLookupPrefix(clientSecret),
      p_secret_hash: hashClientSecret(clientSecret),
      p_scope_codes: scopes,
    },
  );

  if (error) {
    if (error.message.includes("RAES_INSTITUTION_NOT_FOUND")) {
      throw new ProvisioningError(
        404,
        "INSTITUTION_NOT_FOUND",
        "La institución no existe",
      );
    }

    if (error.message.includes("RAES_INVALID_SCOPES")) {
      throw new ProvisioningError(
        400,
        "INVALID_SCOPES",
        "Uno o más scopes no están registrados en RAES",
      );
    }

    throw new ProvisioningError(
      500,
      "INTEGRATION_CREATE_FAILED",
      "No fue posible crear la integración institucional",
    );
  }

  const integration = Array.isArray(data) ? data[0] : null;

  if (!integration) {
    throw new ProvisioningError(
      500,
      "INTEGRATION_CREATE_FAILED",
      "RAES no devolvió la integración creada",
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
    integration,
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
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const { data, error } = await supabase.rpc(
    "aprovisionar_cliente_api",
    {
      p_nombre: input.nombre,
      p_tipo_cliente: input.tipoCliente,
      p_client_id: clientId,
      p_key_prefix: getSecretLookupPrefix(clientSecret),
      p_secret_hash: hashClientSecret(clientSecret),
      p_scope_codes: input.scopes,
    },
  );

  if (error) {
    if (error.message.includes("RAES_INVALID_SCOPES")) {
      throw new ProvisioningError(
        400,
        "INVALID_SCOPES",
        "Uno o más scopes no están registrados en RAES",
      );
    }

    if (error.message.includes("RAES_INVALID_API_CLIENT_TYPE")) {
      throw new ProvisioningError(
        400,
        "INVALID_API_CLIENT_TYPE",
        "El tipo de cliente de API no es válido",
      );
    }

    throw new ProvisioningError(
      500,
      "API_CLIENT_CREATE_FAILED",
      "No fue posible crear el cliente de API",
    );
  }

  const client = Array.isArray(data) ? data[0] : null;

  if (!client) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_CREATE_FAILED",
      "RAES no devolvió el cliente de API creado",
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
    client,
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

  const { data, error, count } = await supabase
    .from("clientes_api")
    .select(
      "id,nombre,tipo_cliente,client_id,estado,ultimo_uso_at,created_at,updated_at",
      { count: "exact" },
    )
    .order("nombre")
    .limit(1000);

  if (error) {
    throw new ProvisioningError(
      500,
      "API_CLIENT_LIST_FAILED",
      "No fue posible consultar los clientes de API",
    );
  }

  if (count === null || count !== (data?.length ?? 0)) {
    throw new ProvisioningError(503, "LIST_LIMIT_EXCEEDED", "La consulta requiere paginación antes de poder devolver un listado completo");
  }
  return data ?? [];
}

export class ProvisioningError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500 | 503,
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

  console.error("Unexpected RAES provisioning error");

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error inesperado",
    },
    { status: 500 },
  );
}
