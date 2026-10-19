import { getCredenlySupabaseAdmin } from "./supabase-admin";
import { CredenlyAdminError } from "./admin-auth";
function unavailable(): never {
  throw new CredenlyAdminError(
    503,
    "OPERATIONS_UNAVAILABLE",
    "No fue posible consultar los indicadores operativos",
  );
}
async function count(
  table: string,
  filters: {
    estado?: string;
    revoked?: "null" | "set";
    after?: string;
    through?: string;
  } = {},
): Promise<number> {
  let query = getCredenlySupabaseAdmin()
    .from(table)
    .select("id", { count: "exact", head: true });
  if (filters.estado) query = query.eq("estado", filters.estado);
  if (filters.revoked === "null") query = query.is("revoked_at", null);
  if (filters.revoked === "set") query = query.not("revoked_at", "is", null);
  if (filters.after) query = query.gt("expires_at", filters.after);
  if (filters.through) query = query.lte("expires_at", filters.through);
  const result = await query;
  if (
    result.error ||
    result.count === null ||
    !Number.isInteger(result.count) ||
    result.count < 0
  )
    unavailable();
  return result.count!;
}
async function stateCounts(table: string, states: readonly string[]) {
  const [total, values] = await Promise.all([
    count(table),
    Promise.all(states.map((state) => count(table, { estado: state }))),
  ]);
  return {
    total,
    byState: Object.fromEntries(states.map((state, i) => [state, values[i]!])),
  };
}
export async function getOperationalOverview() {
  const now = new Date().toISOString();
  const [profiles, verifications, links, shares, incidents] = await Promise.all(
    [
      stateCounts("perfiles", [
        "PENDIENTE_VERIFICACION",
        "ACTIVO",
        "SUSPENDIDO",
        "CERRADO",
      ]),
      stateCounts("verificaciones_identidad", [
        "PENDIENTE",
        "PROCESADA",
        "APROBADA",
        "RECHAZADA",
        "REVISION",
      ]),
      stateCounts("vinculaciones_raes", [
        "PENDIENTE",
        "VERIFICADA",
        "RECHAZADA",
        "REVOCADA",
      ]),
      Promise.all([
        count("comparticiones"),
        count("comparticiones", { revoked: "null", after: now }),
        count("comparticiones", { revoked: "set" }),
        count("comparticiones", { revoked: "null", through: now }),
      ]),
      getCredenlySupabaseAdmin()
        .from("auditoria_admin")
        .select("id,accion,resultado,created_at")
        .eq("resultado", "ERROR")
        .order("created_at", { ascending: false })
        .limit(10),
    ],
  );
  if (incidents.error) unavailable();
  return {
    observedAt: now,
    profiles,
    verifications,
    links,
    shares: {
      total: shares[0]!,
      byState: {
        ACTIVA: shares[1]!,
        REVOCADA: shares[2]!,
        EXPIRADA: shares[3]!,
      },
    },
    incidents: (incidents.data ?? []).map((row) => ({
      id: row.id,
      action: row.accion,
      result: row.resultado,
      occurredAt: row.created_at,
    })),
    incidentSource: "auditoria_admin",
  };
}
export async function getAuthAccounts(request: Request) {
  const pageRaw = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/.test(pageRaw))
    throw new CredenlyAdminError(
      400,
      "INVALID_PAGE",
      "La página solicitada no es válida",
    );
  const page = Number(pageRaw),
    pageSize = 20;
  const result = await getCredenlySupabaseAdmin().auth.admin.listUsers({
    page,
    perPage: pageSize,
  });
  if (result.error) unavailable();
  return {
    page,
    pageSize,
    hasMore: result.data.users.length === pageSize,
    items: result.data.users.map((user) => ({
      id: user.id,
      emailConfirmed: !!user.email_confirmed_at,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
    })),
  };
}
