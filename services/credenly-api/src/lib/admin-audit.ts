import {
  CredenlyAdminError,
  type CredenlyAdminProfile,
  authenticateCredenlyAdmin,
  adminErrorResponse,
} from "./admin-auth";
import { getCredenlySupabaseAdmin } from "./supabase-admin";
export type AdminAction =
  | "ADMIN_PROFILE_READ"
  | "OPERATIONS_READ"
  | "AUTH_ACCOUNTS_READ"
  | "HEALTH_READ";
type Resource = "ADMIN_PROFILE" | "OPERATIONS" | "AUTH_ACCOUNTS" | "HEALTH";
async function audit(
  actor: CredenlyAdminProfile,
  action: AdminAction,
  resource: Resource,
  result: "EXITO" | "ERROR",
) {
  try {
    const write = await getCredenlySupabaseAdmin()
      .from("auditoria_admin")
      .insert({
        actor_id: actor.id,
        accion: action,
        resultado: result,
        recurso_tipo: resource,
        recurso_id: resource === "ADMIN_PROFILE" ? actor.id : null,
      });
    if (write.error) throw new Error("AUDIT_FAILED");
  } catch {
    throw new CredenlyAdminError(
      503,
      "ADMIN_AUDIT_UNAVAILABLE",
      "No fue posible registrar la consulta administrativa",
    );
  }
}
export async function administrativeRead(
  request: Request,
  action: AdminAction,
  resource: Resource,
  read: (admin: CredenlyAdminProfile) => Promise<unknown>,
) {
  let admin: CredenlyAdminProfile;
  try {
    admin = await authenticateCredenlyAdmin(request);
  } catch (error) {
    return adminErrorResponse(error);
  }
  let data: unknown;
  try {
    data = await read(admin);
  } catch (error) {
    try {
      await audit(admin, action, resource, "ERROR");
    } catch (auditError) {
      return adminErrorResponse(auditError);
    }
    return adminErrorResponse(error);
  }
  try {
    await audit(admin, action, resource, "EXITO");
  } catch (error) {
    return adminErrorResponse(error);
  }
  return Response.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
