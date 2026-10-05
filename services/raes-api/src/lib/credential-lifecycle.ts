import type {
  AnulacionCredencial,
  CorreccionCredencial,
  RevocacionCredencial,
} from "@raes/contracts";

import { ApiError } from "./api-error";
import type { MutationRequestContext } from "./idempotency";
import type { InstitutionalIdentity } from "./institution-auth";
import { getRaesSupabaseAdmin } from "./supabase-admin";

type LifecycleRow = {
  operacion_id: string;
  credencial_id: string;
  codigo_raes: string;
  numero_version: number;
  estado_actual: string;
  replayed: boolean;
};

export type CredentialLifecycleResult = {
  operationId: string;
  credentialId: string;
  codigoRaes: string;
  version: number;
  estado: string;
  replayed: boolean;
};

export async function correctCredential(
  identity: InstitutionalIdentity,
  context: MutationRequestContext,
  requestHash: string,
  input: CorreccionCredencial,
): Promise<CredentialLifecycleResult> {
  const supabase = getRaesSupabaseAdmin();
  const updated = input.datosActualizados;

  const { data, error } = await supabase.rpc(
    "corregir_credencial",
    {
      p_integracion_id: identity.integrationId,
      p_request_id: context.requestId,
      p_idempotency_key: context.idempotencyKey,
      p_request_hash: requestHash,
      p_codigo_origen: input.codigoOrigen,
      p_motivo: input.motivo,
      p_ocurrido_at: input.ocurridoAt,
      p_programa_codigo_origen:
        updated.programaCodigoOrigen ?? null,
      p_sede_codigo_origen:
        updated.sedeCodigoOrigen ?? null,
      p_tipo: updated.tipo,
      p_categoria: updated.categoria,
      p_titulo: updated.titulo,
      p_descripcion: updated.descripcion ?? null,
      p_fecha_emision: updated.fechaEmision,
      p_fecha_grado: updated.fechaGrado ?? null,
      p_numero_acta: updated.numeroActa ?? null,
      p_numero_folio: updated.numeroFolio ?? null,
      p_numero_libro: updated.numeroLibro ?? null,
      p_documento_hash_sha256:
        updated.documentoHashSha256 ?? null,
      p_payload_original: input,
    },
  );

  if (error) {
    throw mapCredentialLifecycleError(error.message);
  }

  return mapLifecycleResult(data, "CREDENTIAL_CORRECTION_EMPTY_RESULT");
}

export async function revokeCredential(
  identity: InstitutionalIdentity,
  context: MutationRequestContext,
  requestHash: string,
  input: RevocacionCredencial,
): Promise<CredentialLifecycleResult> {
  return transitionCredentialState(
    identity,
    context,
    requestHash,
    "CREDENTIAL_REVOKE",
    input,
  );
}

export async function annulCredential(
  identity: InstitutionalIdentity,
  context: MutationRequestContext,
  requestHash: string,
  input: AnulacionCredencial,
): Promise<CredentialLifecycleResult> {
  return transitionCredentialState(
    identity,
    context,
    requestHash,
    "CREDENTIAL_ANNUL",
    input,
  );
}

async function transitionCredentialState(
  identity: InstitutionalIdentity,
  context: MutationRequestContext,
  requestHash: string,
  operation: "CREDENTIAL_REVOKE" | "CREDENTIAL_ANNUL",
  input: RevocacionCredencial | AnulacionCredencial,
): Promise<CredentialLifecycleResult> {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase.rpc(
    "transicionar_estado_credencial",
    {
      p_integracion_id: identity.integrationId,
      p_request_id: context.requestId,
      p_idempotency_key: context.idempotencyKey,
      p_request_hash: requestHash,
      p_operacion: operation,
      p_codigo_origen: input.codigoOrigen,
      p_motivo: input.motivo,
      p_ocurrido_at: input.ocurridoAt,
      p_payload_original: input,
    },
  );

  if (error) {
    throw mapCredentialLifecycleError(error.message);
  }

  return mapLifecycleResult(data, "CREDENTIAL_TRANSITION_EMPTY_RESULT");
}

function mapLifecycleResult(
  data: unknown,
  emptyResultCode: string,
): CredentialLifecycleResult {
  const row = (data as LifecycleRow[] | null)?.[0];

  if (!row) {
    throw new ApiError(
      500,
      emptyResultCode,
      "RAES no devolvió el resultado de la operación sobre la credencial",
    );
  }

  return {
    operationId: row.operacion_id,
    credentialId: row.credencial_id,
    codigoRaes: row.codigo_raes,
    version: row.numero_version,
    estado: row.estado_actual,
    replayed: row.replayed,
  };
}

function mapCredentialLifecycleError(message: string): ApiError {
  if (message.includes("RAES_IDEMPOTENCY_CONFLICT")) {
    return new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "La Idempotency-Key ya fue utilizada con un payload diferente",
    );
  }

  if (message.includes("RAES_IDEMPOTENCY_OPERATION_CONFLICT")) {
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

  if (message.includes("RAES_CREDENTIAL_NOT_FOUND")) {
    return new ApiError(
      404,
      "CREDENTIAL_NOT_FOUND",
      "La credencial indicada no existe para la institución autenticada",
    );
  }

  if (message.includes("RAES_CREDENTIAL_NOT_EDITABLE")) {
    return new ApiError(
      409,
      "CREDENTIAL_NOT_EDITABLE",
      "Solo una credencial VIGENTE puede ser corregida",
    );
  }

  if (message.includes("RAES_CREDENTIAL_NOT_TRANSITIONABLE")) {
    return new ApiError(
      409,
      "CREDENTIAL_NOT_TRANSITIONABLE",
      "La credencial ya se encuentra en un estado terminal",
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

  if (message.includes("RAES_CURRENT_VERSION_NOT_FOUND")) {
    return new ApiError(
      500,
      "CURRENT_VERSION_NOT_FOUND",
      "RAES no pudo localizar la versión actual de la credencial",
    );
  }

  console.error("Credential lifecycle RPC failed", {
    databaseMessage: message,
  });

  return new ApiError(
    500,
    "CREDENTIAL_LIFECYCLE_ERROR",
    "No fue posible completar la operación sobre la credencial",
  );
}
