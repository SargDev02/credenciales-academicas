import { extractBearerToken, CitizenAuthError } from "./auth";
import { getCredenlySupabaseAdmin } from "./supabase-admin";

export type CredenlyAdminProfile = { id: string; nombres: string; apellidos: string; rol: "ADMIN_CREDENLY"; estado: "ACTIVO" };
export class CredenlyAdminError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 500 | 503, public readonly code: string, message: string) { super(message); this.name = "CredenlyAdminError"; }
}
export async function authenticateCredenlyAdmin(request: Request): Promise<CredenlyAdminProfile> {
  const token = extractBearerToken(request.headers.get("authorization"));
  const db = getCredenlySupabaseAdmin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new CredenlyAdminError(401, "SESSION_INVALID", "La sesión administrativa no es válida o expiró");
  const result = await db.from("perfiles_admin").select("id,nombres,apellidos,rol,estado").eq("id", data.user.id).maybeSingle();
  if (result.error) throw new CredenlyAdminError(503, "ADMIN_VALIDATION_UNAVAILABLE", "No fue posible validar el acceso administrativo");
  const profile = result.data;
  if (!profile || profile.id !== data.user.id || profile.estado !== "ACTIVO" || profile.rol !== "ADMIN_CREDENLY") throw new CredenlyAdminError(403, "ADMIN_ACCESS_DENIED", "La cuenta no tiene acceso administrativo activo en Credenly");
  // Never serialize Auth metadata or project future profile columns to the client.
  return { id: profile.id, nombres: profile.nombres, apellidos: profile.apellidos, rol: "ADMIN_CREDENLY", estado: "ACTIVO" };
}
export function adminErrorResponse(error: unknown) {
  if (error instanceof CredenlyAdminError || error instanceof CitizenAuthError) return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  console.error("Credenly administrative request failed");
  return Response.json({ error: "ADMIN_UNAVAILABLE", message: "No fue posible completar la consulta administrativa" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
