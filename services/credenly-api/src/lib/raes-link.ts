import { getCredenlySupabaseAdmin } from "./supabase-admin";
import {
  RaesClientError,
  getRaesCredentialsForPerson,
  resolveRaesPerson,
  type RaesCredential,
} from "./raes-client";

export type RaesLinkRow = {
  id: string;
  usuario_id: string;
  raes_persona_id: string;
  verificacion_identidad_id: string | null;
  estado: "PENDIENTE" | "VERIFICADA" | "RECHAZADA" | "REVOCADA";
  metodo_verificacion: "OCR_DOCUMENTO";
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type VerificationRow = {
  id: string;
  usuario_id: string;
  tipo_documento_extraido: string | null;
  numero_documento_extraido: string | null;
  estado: string;
};

export class RaesLinkError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RaesLinkError";
  }
}

export async function getRaesLinkForUser(
  userId: string,
): Promise<RaesLinkRow | null> {
  const supabase = getCredenlySupabaseAdmin();

  const { data, error } = await supabase
    .from("vinculaciones_raes")
    .select(
      "id,usuario_id,raes_persona_id,verificacion_identidad_id,estado,metodo_verificacion,verified_at,created_at,updated_at",
    )
    .eq("usuario_id", userId)
    .maybeSingle();

  if (error) {
    throw new RaesLinkError(
      500,
      "RAES_LINK_LOOKUP_FAILED",
      "No fue posible consultar la vinculación con RAES",
    );
  }

  return data as RaesLinkRow | null;
}

export async function linkApprovedVerificationToRaes(
  userId: string,
  verificationId: string,
): Promise<RaesLinkRow> {
  const supabase = getCredenlySupabaseAdmin();

  const { data: verificationData, error: verificationError } =
    await supabase
      .from("verificaciones_identidad")
      .select(
        "id,usuario_id,tipo_documento_extraido,numero_documento_extraido,estado",
      )
      .eq("id", verificationId)
      .eq("usuario_id", userId)
      .maybeSingle();

  if (verificationError) {
    throw new RaesLinkError(
      500,
      "IDENTITY_VERIFICATION_LOOKUP_FAILED",
      "No fue posible consultar la verificación de identidad",
    );
  }

  const verification = verificationData as VerificationRow | null;

  if (!verification) {
    throw new RaesLinkError(
      404,
      "IDENTITY_VERIFICATION_NOT_FOUND",
      "La verificación de identidad no existe",
    );
  }

  if (verification.estado !== "APROBADA") {
    throw new RaesLinkError(
      409,
      "IDENTITY_VERIFICATION_NOT_APPROVED",
      "La verificación de identidad todavía no está aprobada",
    );
  }

  if (
    !verification.tipo_documento_extraido ||
    !verification.numero_documento_extraido
  ) {
    throw new RaesLinkError(
      409,
      "IDENTITY_DOCUMENT_INCOMPLETE",
      "La verificación aprobada no contiene una identidad utilizable",
    );
  }

  let person;

  try {
    person = await resolveRaesPerson({
      tipoDocumento:
        verification.tipo_documento_extraido.toUpperCase(),
      numeroDocumento:
        verification.numero_documento_extraido,
    });
  } catch (error) {
    if (error instanceof RaesClientError && error.status === 404) {
      throw new RaesLinkError(
        404,
        "RAES_PERSON_NOT_FOUND",
        "La identidad verificada no tiene una persona asociada en RAES",
      );
    }

    throw error;
  }

  const { data, error } = await supabase.rpc(
    "confirmar_vinculacion_raes",
    {
      p_usuario_id: userId,
      p_verificacion_identidad_id: verification.id,
      p_raes_persona_id: person.id,
    },
  );

  if (error) {
    if (
      error.message.includes(
        "CREDENLY_VERIFICATION_NOT_APPROVED",
      )
    ) {
      throw new RaesLinkError(
        409,
        "IDENTITY_VERIFICATION_NOT_APPROVED",
        "La verificación de identidad ya no está aprobada",
      );
    }

    if (
      error.message.includes(
        "CREDENLY_RAES_PERSON_ALREADY_LINKED",
      )
    ) {
      throw new RaesLinkError(
        409,
        "RAES_PERSON_ALREADY_LINKED",
        "La persona RAES ya está vinculada a otra cuenta Credenly",
      );
    }

    throw new RaesLinkError(
      500,
      "RAES_LINK_CONFIRM_FAILED",
      "No fue posible confirmar la vinculación con RAES",
    );
  }

  return data as RaesLinkRow;
}

export async function getLiveCredentialsForUser(
  userId: string,
): Promise<RaesCredential[]> {
  const link = await getRaesLinkForUser(userId);

  if (!link || link.estado !== "VERIFICADA") {
    throw new RaesLinkError(
      409,
      "RAES_LINK_REQUIRED",
      "La cuenta debe tener una vinculación RAES verificada",
    );
  }

  return getRaesCredentialsForPerson(link.raes_persona_id);
}

export function raesIntegrationErrorResponse(
  error: unknown,
): Response {
  if (error instanceof RaesLinkError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  if (error instanceof RaesClientError) {
    const status =
      error.status >= 400 && error.status <= 599
        ? error.status
        : 502;

    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status },
    );
  }

  console.error("Unexpected Credenly RAES integration error");

  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "No fue posible completar la operación con RAES",
    },
    { status: 500 },
  );
}
