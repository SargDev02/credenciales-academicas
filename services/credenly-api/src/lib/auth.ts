import type { User } from "@supabase/supabase-js";

import { getCredenlySupabaseAdmin } from "./supabase-admin";

export class CitizenAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CitizenAuthError";
  }
}

export function extractBearerToken(
  authorizationHeader: string | null,
): string {
  if (!authorizationHeader) {
    throw new CitizenAuthError(
      401,
      "AUTHORIZATION_REQUIRED",
      "Se requiere Authorization Bearer",
    );
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new CitizenAuthError(
      401,
      "AUTHORIZATION_INVALID",
      "El header Authorization no tiene un Bearer token válido",
    );
  }

  return token;
}

export async function authenticateCitizen(
  request: Request,
): Promise<User> {
  const token = extractBearerToken(
    request.headers.get("authorization"),
  );
  const supabase = getCredenlySupabaseAdmin();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new CitizenAuthError(
      401,
      "SESSION_INVALID",
      "La sesión de Credenly no es válida o expiró",
    );
  }

  // Administrative identity never automatically inherits citizen access, even
  // when the admin profile is inactive. No email or editable metadata decisions.
  const admin = await supabase.from("perfiles_admin").select("id").eq("id", data.user.id).maybeSingle();
  if (admin.error) throw new CitizenAuthError(503, "CITIZEN_ACCESS_UNAVAILABLE", "No fue posible validar el acceso ciudadano");
  if (admin.data) throw new CitizenAuthError(403, "CITIZEN_ACCESS_DENIED", "Esta cuenta administrativa no tiene acceso al flujo ciudadano");
  return data.user;
}

export function citizenAuthErrorResponse(
  error: unknown,
): Response {
  if (error instanceof CitizenAuthError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Credenly authentication failed");

  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "No fue posible completar la autenticación",
    },
    { status: 500 },
  );
}
