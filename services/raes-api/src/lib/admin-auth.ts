import type { User } from "@supabase/supabase-js";

import { getRaesSupabaseAdmin } from "./supabase-admin";

export type AdminRole = "SUPERADMIN" | "ADMIN" | "AUDITOR";

export type AdminIdentity = {
  user: User;
  profile: {
    id: string;
    nombres: string;
    apellidos: string;
    rol: AdminRole;
    estado: string;
  };
};

export class AdminAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

function extractBearerToken(
  authorizationHeader: string | null,
): string {
  if (!authorizationHeader) {
    throw new AdminAuthError(
      401,
      "AUTHORIZATION_REQUIRED",
      "Se requiere Authorization Bearer",
    );
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new AdminAuthError(
      401,
      "AUTHORIZATION_INVALID",
      "El header Authorization no tiene un token válido",
    );
  }

  return token;
}

export async function authenticateAdmin(
  request: Request,
  allowedRoles: AdminRole[] = ["SUPERADMIN", "ADMIN"],
): Promise<AdminIdentity> {
  const token = extractBearerToken(
    request.headers.get("authorization"),
  );
  const supabase = getRaesSupabaseAdmin();

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    throw new AdminAuthError(
      401,
      "SESSION_INVALID",
      "La sesión administrativa no es válida o expiró",
    );
  }

  const { data: profileData, error: profileError } = await supabase
    .from("perfiles_admin")
    .select("id,nombres,apellidos,rol,estado")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("RAES admin profile lookup failed", {
      code: profileError.code,
    });

    throw new AdminAuthError(
      500,
      "AUTHENTICATION_ERROR",
      "No fue posible validar el perfil administrativo",
    );
  }

  const profile = profileData as AdminIdentity["profile"] | null;

  if (!profile || profile.estado !== "ACTIVO") {
    throw new AdminAuthError(
      403,
      "ADMIN_ACCESS_DENIED",
      "El usuario no tiene acceso administrativo activo",
    );
  }

  if (!allowedRoles.includes(profile.rol)) {
    throw new AdminAuthError(
      403,
      "INSUFFICIENT_ROLE",
      "El rol administrativo no permite esta operación",
    );
  }

  return {
    user: userData.user,
    profile,
  };
}

export function adminAuthErrorResponse(
  error: unknown,
): Response {
  if (error instanceof AdminAuthError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Unexpected RAES admin authentication error", {
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
