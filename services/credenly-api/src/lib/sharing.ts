import { z } from "zod";

import { getServerEnv } from "./env";
import {
  RaesClientError,
  type RaesCredential,
} from "./raes-client";
import {
  RaesLinkError,
  getLiveCredentialsForUser,
  getRaesLinkForUser,
} from "./raes-link";
import { getRaesCredentialsForPerson } from "./raes-client";
import { getCredenlySupabaseAdmin } from "./supabase-admin";
import {
  generateShareToken,
  getShareTokenPrefix,
  hashAccessIp,
  hashShareToken,
  isValidShareTokenFormat,
} from "./share-token";

const visibleFieldSchema = z.enum([
  "programa",
  "sede",
  "descripcion",
  "fechaGrado",
  "numeroActa",
  "numeroFolio",
  "numeroLibro",
  "motivoEstado",
]);

export const createShareInputSchema = z.object({
  raesCredencialId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(168),
  camposVisibles: z
    .array(visibleFieldSchema)
    .max(8)
    .default(["programa", "sede", "fechaGrado"]),
});

export type VisibleShareField = z.infer<typeof visibleFieldSchema>;

type ShareRow = {
  id: string;
  usuario_id: string;
  raes_credencial_id: string;
  token_prefix: string;
  token_hash: string;
  campos_visibles: unknown;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export class ShareError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 410 | 500 | 502 | 504,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ShareError";
  }
}

function parseVisibleFields(value: unknown): VisibleShareField[] {
  const result = z.array(visibleFieldSchema).safeParse(value);
  return result.success ? result.data : [];
}

function mapShareRow(row: ShareRow) {
  return {
    id: row.id,
    raesCredencialId: row.raes_credencial_id,
    tokenPrefix: row.token_prefix,
    camposVisibles: parseVisibleFields(row.campos_visibles),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    estado: row.revoked_at
      ? "REVOCADA"
      : new Date(row.expires_at).getTime() <= Date.now()
        ? "EXPIRADA"
        : "ACTIVA",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createShare(
  userId: string,
  input: z.infer<typeof createShareInputSchema>,
) {
  const credentials = await getLiveCredentialsForUser(userId);
  const credential = credentials.find(
    (item) => item.id === input.raesCredencialId,
  );

  if (!credential) {
    throw new ShareError(
      404,
      "CREDENTIAL_NOT_OWNED",
      "La credencial no pertenece a la identidad RAES vinculada",
    );
  }

  const token = generateShareToken();
  const tokenHash = hashShareToken(token);
  const expiresAt = new Date(
    Date.now() + input.expiresInHours * 60 * 60 * 1000,
  ).toISOString();

  const supabase = getCredenlySupabaseAdmin();
  const { data, error } = await supabase
    .from("comparticiones")
    .insert({
      usuario_id: userId,
      raes_credencial_id: credential.id,
      token_prefix: getShareTokenPrefix(token),
      token_hash: tokenHash,
      campos_visibles: input.camposVisibles,
      expires_at: expiresAt,
    })
    .select(
      "id,usuario_id,raes_credencial_id,token_prefix,token_hash,campos_visibles,expires_at,revoked_at,created_at,updated_at",
    )
    .single();

  if (error || !data) {
    throw new ShareError(
      500,
      "SHARE_CREATE_FAILED",
      "No fue posible crear la compartición",
    );
  }

  return {
    share: mapShareRow(data as ShareRow),
    token,
    publicPath: `/api/v1/public/shares/${token}`,
  };
}

export async function listShares(userId: string) {
  const supabase = getCredenlySupabaseAdmin();
  const { data, error } = await supabase
    .from("comparticiones")
    .select(
      "id,usuario_id,raes_credencial_id,token_prefix,token_hash,campos_visibles,expires_at,revoked_at,created_at,updated_at",
    )
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ShareError(
      500,
      "SHARE_LIST_FAILED",
      "No fue posible consultar las comparticiones",
    );
  }

  return (data as ShareRow[]).map(mapShareRow);
}

export async function revokeShare(
  userId: string,
  shareId: string,
) {
  const supabase = getCredenlySupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("comparticiones")
    .update({
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", shareId)
    .eq("usuario_id", userId)
    .is("revoked_at", null)
    .select(
      "id,usuario_id,raes_credencial_id,token_prefix,token_hash,campos_visibles,expires_at,revoked_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new ShareError(
      500,
      "SHARE_REVOKE_FAILED",
      "No fue posible revocar la compartición",
    );
  }

  if (!data) {
    const { data: existing, error: lookupError } = await supabase
      .from("comparticiones")
      .select("id,revoked_at")
      .eq("id", shareId)
      .eq("usuario_id", userId)
      .maybeSingle();

    if (lookupError) {
      throw new ShareError(
        500,
        "SHARE_LOOKUP_FAILED",
        "No fue posible consultar la compartición",
      );
    }

    if (!existing) {
      throw new ShareError(
        404,
        "SHARE_NOT_FOUND",
        "La compartición no existe",
      );
    }

    throw new ShareError(
      409,
      "SHARE_ALREADY_REVOKED",
      "La compartición ya estaba revocada",
    );
  }

  return mapShareRow(data as ShareRow);
}

function projectCredential(
  credential: RaesCredential,
  visibleFields: VisibleShareField[],
) {
  const visible = new Set(visibleFields);

  return {
    codigoRaes: credential.codigoRaes,
    tipo: credential.tipo,
    categoria: credential.categoria,
    estadoActual: credential.estadoActual,
    versionActual: credential.versionActual,
    institucion: credential.institucion
      ? {
          nombre: credential.institucion.nombre,
          nit: credential.institucion.nit,
        }
      : null,
    titulo: credential.version?.titulo ?? null,
    fechaEmision: credential.version?.fechaEmision ?? null,
    programa: visible.has("programa")
      ? credential.programa
        ? { nombre: credential.programa.nombre }
        : null
      : undefined,
    sede: visible.has("sede")
      ? credential.sede
        ? {
            nombre: credential.sede.nombre,
            municipio: credential.sede.municipio,
          }
        : null
      : undefined,
    descripcion: visible.has("descripcion")
      ? credential.version?.descripcion ?? null
      : undefined,
    fechaGrado: visible.has("fechaGrado")
      ? credential.version?.fechaGrado ?? null
      : undefined,
    numeroActa: visible.has("numeroActa")
      ? credential.version?.numeroActa ?? null
      : undefined,
    numeroFolio: visible.has("numeroFolio")
      ? credential.version?.numeroFolio ?? null
      : undefined,
    numeroLibro: visible.has("numeroLibro")
      ? credential.version?.numeroLibro ?? null
      : undefined,
    motivoEstado: visible.has("motivoEstado")
      ? credential.estadoActual === "REVOCADA"
        ? credential.motivoRevocacion
        : credential.estadoActual === "ANULADA"
          ? credential.motivoAnulacion
          : null
      : undefined,
    fechaEstadoTerminal:
      credential.estadoActual === "REVOCADA"
        ? credential.revocadaAt
        : credential.estadoActual === "ANULADA"
          ? credential.anuladaAt
          : null,
  };
}

async function logShareAccess(
  shareId: string,
  resultado:
    | "OK"
    | "ENLACE_EXPIRADO"
    | "ENLACE_REVOCADO"
    | "CREDENCIAL_NO_DISPONIBLE"
    | "ERROR",
  request: Request,
) {
  const supabase = getCredenlySupabaseAdmin();
  const env = getServerEnv();

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip");

  const userAgent = request.headers
    .get("user-agent")
    ?.slice(0, 1000) ?? null;

  const { error } = await supabase
    .from("accesos_compartidos")
    .insert({
      comparticion_id: shareId,
      resultado,
      ip_hash: hashAccessIp(
        ip ?? null,
        env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
      ),
      user_agent: userAgent,
    });

  if (error) {
    console.error("Share access audit failed", {
      shareId,
      resultado,
      code: error.code,
    });
  }
}

export async function verifyPublicShare(
  token: string,
  request: Request,
) {
  if (!isValidShareTokenFormat(token)) {
    throw new ShareError(
      404,
      "SHARE_NOT_FOUND",
      "El enlace de verificación no existe",
    );
  }

  const supabase = getCredenlySupabaseAdmin();
  const tokenHash = hashShareToken(token);

  const { data, error } = await supabase
    .from("comparticiones")
    .select(
      "id,usuario_id,raes_credencial_id,token_prefix,token_hash,campos_visibles,expires_at,revoked_at,created_at,updated_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new ShareError(
      500,
      "SHARE_LOOKUP_FAILED",
      "No fue posible consultar el enlace",
    );
  }

  if (!data) {
    throw new ShareError(
      404,
      "SHARE_NOT_FOUND",
      "El enlace de verificación no existe",
    );
  }

  const share = data as ShareRow;

  if (share.revoked_at) {
    await logShareAccess(
      share.id,
      "ENLACE_REVOCADO",
      request,
    );

    throw new ShareError(
      410,
      "SHARE_REVOKED",
      "El enlace de verificación fue revocado",
    );
  }

  if (new Date(share.expires_at).getTime() <= Date.now()) {
    await logShareAccess(
      share.id,
      "ENLACE_EXPIRADO",
      request,
    );

    throw new ShareError(
      410,
      "SHARE_EXPIRED",
      "El enlace de verificación expiró",
    );
  }

  const link = await getRaesLinkForUser(share.usuario_id);

  if (!link || link.estado !== "VERIFICADA") {
    await logShareAccess(
      share.id,
      "CREDENCIAL_NO_DISPONIBLE",
      request,
    );

    throw new ShareError(
      404,
      "CREDENTIAL_NOT_AVAILABLE",
      "La credencial compartida no está disponible",
    );
  }

  try {
    const credentials = await getRaesCredentialsForPerson(
      link.raes_persona_id,
    );
    const credential = credentials.find(
      (item) => item.id === share.raes_credencial_id,
    );

    if (!credential) {
      await logShareAccess(
        share.id,
        "CREDENCIAL_NO_DISPONIBLE",
        request,
      );

      throw new ShareError(
        404,
        "CREDENTIAL_NOT_AVAILABLE",
        "La credencial compartida no está disponible",
      );
    }

    await logShareAccess(share.id, "OK", request);

    return {
      share: {
        id: share.id,
        expiresAt: share.expires_at,
      },
      credential: projectCredential(
        credential,
        parseVisibleFields(share.campos_visibles),
      ),
      source: "RAES" as const,
      persistedByCredenly: false,
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ShareError) {
      throw error;
    }

    await logShareAccess(share.id, "ERROR", request);

    if (error instanceof RaesClientError) {
      throw new ShareError(
        error.status === 504 ? 504 : 502,
        "RAES_UNAVAILABLE",
        "No fue posible consultar RAES en este momento",
      );
    }

    throw error;
  }
}

export function shareErrorResponse(error: unknown): Response {
  if (error instanceof ShareError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

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
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status === 504 ? 504 : 502 },
    );
  }

  console.error("Unexpected share error", {
    message:
      error instanceof Error ? error.message : "unknown error",
  });

  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "No fue posible completar la operación de compartición",
    },
    { status: 500 },
  );
}
