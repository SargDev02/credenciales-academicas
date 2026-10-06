import type { User } from "@supabase/supabase-js";

import { getCredenlySupabaseAdmin } from "./supabase-admin";

export class CitizenAuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
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

  console.error("Credenly authentication failed", {
    message:
      error instanceof Error ? error.message : "unknown error",
  });

  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "No fue posible completar la autenticación",
    },
    { status: 500 },
  );
}
