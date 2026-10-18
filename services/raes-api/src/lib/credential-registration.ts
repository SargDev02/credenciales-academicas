import type { CredencialNueva } from "@raes/contracts";

import { ApiError } from "./api-error";
import type { MutationRequestContext } from "./idempotency";
import type { InstitutionalIdentity } from "./institution-auth";
import { getRaesSupabaseAdmin } from "./supabase-admin";

type RegistrationRow = {
  operacion_id: string;
  credencial_id: string;
  codigo_raes: string;
  numero_version: number;
  replayed: boolean;
};

export type CredentialRegistrationResult = {
  operationId: string;
  credentialId: string;
  codigoRaes: string;
  version: number;
  replayed: boolean;
};

export async function registerInitialCredential(
  identity: InstitutionalIdentity,
  context: MutationRequestContext,
  requestHash: string,
  input: CredencialNueva,
): Promise<CredentialRegistrationResult> {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase.rpc(
    "registrar_credencial_inicial",
    {
      p_integracion_id: identity.integrationId,
      p_request_id: context.requestId,
      p_idempotency_key: context.idempotencyKey,
      p_request_hash: requestHash,
      p_persona_identificador_origen:
        input.personaIdentificadorOrigen,
      p_programa_codigo_origen:
        input.programaCodigoOrigen ?? null,
      p_sede_codigo_origen:
        input.sedeCodigoOrigen ?? null,
      p_codigo_origen: input.codigoOrigen,
      p_tipo: input.tipo,
      p_categoria: input.categoria,
      p_titulo: input.titulo,
      p_descripcion: input.descripcion ?? null,
      p_fecha_emision: input.fechaEmision,
      p_fecha_grado: input.fechaGrado ?? null,
      p_numero_acta: input.numeroActa ?? null,
      p_numero_folio: input.numeroFolio ?? null,
      p_numero_libro: input.numeroLibro ?? null,
      p_documento_hash_sha256:
        input.documentoHashSha256 ?? null,
      p_payload_original: input,
    },
  );

  if (error) {
    throw mapCredentialRegistrationError(error.message);
  }

  const row = (data as RegistrationRow[] | null)?.[0];

  if (!row) {
    throw new ApiError(
      500,
      "CREDENTIAL_REGISTRATION_EMPTY_RESULT",
      "RAES no devolvió el resultado del registro de la credencial",
    );
  }

  return {
    operationId: row.operacion_id,
    credentialId: row.credencial_id,
    codigoRaes: row.codigo_raes,
    version: row.numero_version,
    replayed: row.replayed,
  };
}

function mapCredentialRegistrationError(message: string): ApiError {
  if (message.includes("RAES_IDEMPOTENCY_CONFLICT")) {
    return new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "La Idempotency-Key ya fue utilizada con un payload diferente",
    );
  }

  if (
    message.includes("RAES_IDEMPOTENCY_OPERATION_CONFLICT")
  ) {
    return new ApiError(
      409,
      "IDEMPOTENCY_OPERATION_CONFLICT",
      "La Idempotency-Key ya fue utilizada para otra operación",
    );
  }

  if (message.includes("RAES_IDEMPOTENCY_IN_PROGRESS")) {
    return new ApiError(
      409,
      "IDEMPOTENCY_IN_PROGRESS",
      "Existe una operación con esta Idempotency-Key que todavía no está completada",
    );
  }

  if (message.includes("RAES_REQUEST_ID_CONFLICT")) {
    return new ApiError(
      409,
      "REQUEST_ID_CONFLICT",
      "X-Request-Id ya fue utilizado en otra operación",
    );
  }

  if (message.includes("RAES_PERSON_SOURCE_NOT_FOUND")) {
    return new ApiError(
      404,
      "PERSON_NOT_SYNCED",
      "La persona institucional aún no ha sido sincronizada con RAES",
    );
  }

  if (message.includes("RAES_PROGRAM_NOT_FOUND")) {
    return new ApiError(
      404,
      "PROGRAM_NOT_SYNCED",
      "El programa reportado aún no ha sido sincronizado con RAES",
    );
  }

  if (message.includes("RAES_CAMPUS_NOT_FOUND")) {
    return new ApiError(
      404,
      "CAMPUS_NOT_SYNCED",
      "La sede reportada aún no ha sido sincronizada con RAES",
    );
  }

  if (message.includes("RAES_CREDENTIAL_ALREADY_EXISTS")) {
    return new ApiError(
      409,
      "CREDENTIAL_ALREADY_EXISTS",
      "Ya existe una credencial con este codigoOrigen para la institución",
    );
  }

  console.error("Credential registration RPC failed");

  return new ApiError(
    500,
    "CREDENTIAL_REGISTRATION_ERROR",
    "No fue posible registrar la credencial en RAES",
  );
}
