export const adminCookieName = "credenly-admin-web-auth";
export type AdminProfile = {
  id: string;
  nombres: string;
  apellidos: string;
  rol: "ADMIN_CREDENLY";
  estado: "ACTIVO";
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function isAdminProfile(v: unknown): v is { data: AdminProfile } {
  return (
    record(v) &&
    record(v.data) &&
    ["id", "nombres", "apellidos"].every(
      (k) => typeof (v.data as Record<string, unknown>)[k] === "string",
    ) &&
    v.data.rol === "ADMIN_CREDENLY" &&
    v.data.estado === "ACTIVO"
  );
}
export type Counts = { total: number; byState: Record<string, number> };
export type Overview = {
  observedAt: string;
  profiles: Counts;
  verifications: Counts;
  links: Counts;
  shares: Counts;
  incidents: {
    id: string;
    action: string;
    result: "ERROR";
    occurredAt: string;
  }[];
  incidentSource: "auditoria_admin";
};
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
function isCounts(v: unknown, states: string[]): v is Counts {
  return (
    record(v) &&
    count(v.total) &&
    record(v.byState) &&
    states.every((state) =>
      count((v.byState as Record<string, unknown>)[state]),
    )
  );
}
export function isOverview(v: unknown): v is { data: Overview } {
  if (!record(v) || !record(v.data)) return false;
  const d = v.data;
  return (
    typeof d.observedAt === "string" &&
    isCounts(d.profiles, [
      "PENDIENTE_VERIFICACION",
      "ACTIVO",
      "SUSPENDIDO",
      "CERRADO",
    ]) &&
    isCounts(d.verifications, [
      "PENDIENTE",
      "PROCESADA",
      "APROBADA",
      "RECHAZADA",
      "REVISION",
    ]) &&
    isCounts(d.links, ["PENDIENTE", "VERIFICADA", "RECHAZADA", "REVOCADA"]) &&
    isCounts(d.shares, ["ACTIVA", "REVOCADA", "EXPIRADA"]) &&
    d.incidentSource === "auditoria_admin" &&
    Array.isArray(d.incidents) &&
    d.incidents.every(
      (i) =>
        record(i) &&
        ["id", "occurredAt"].every((k) => typeof i[k] === "string") &&
        [
          "ADMIN_PROFILE_READ",
          "OPERATIONS_READ",
          "AUTH_ACCOUNTS_READ",
          "HEALTH_READ",
        ].includes(String(i.action)) &&
        i.result === "ERROR",
    )
  );
}
export type AuthAccounts = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  items: {
    id: string;
    emailConfirmed: boolean;
    createdAt: string;
    lastSignInAt: string | null;
  }[];
};
export function isAuthAccounts(v: unknown): v is { data: AuthAccounts } {
  return (
    record(v) &&
    record(v.data) &&
    count(v.data.page) &&
    v.data.page > 0 &&
    v.data.pageSize === 20 &&
    typeof v.data.hasMore === "boolean" &&
    Array.isArray(v.data.items) &&
    v.data.items.every(
      (i) =>
        record(i) &&
        typeof i.id === "string" &&
        typeof i.emailConfirmed === "boolean" &&
        typeof i.createdAt === "string" &&
        (i.lastSignInAt === null || typeof i.lastSignInAt === "string"),
    )
  );
}
export type Health = {
  checkedAt: string;
  httpStatus: number;
  status: "ready" | "not_ready";
  components: {
    database: "up" | "down";
    auth: "configured" | "unavailable";
    raes: "up" | "down";
  };
};
export function isHealth(v: unknown): v is { data: Health } {
  return (
    record(v) &&
    record(v.data) &&
    typeof v.data.checkedAt === "string" &&
    [200, 503].includes(Number(v.data.httpStatus)) &&
    ["ready", "not_ready"].includes(String(v.data.status)) &&
    record(v.data.components) &&
    ["up", "down"].includes(String(v.data.components.database)) &&
    ["configured", "unavailable"].includes(String(v.data.components.auth)) &&
    ["up", "down"].includes(String(v.data.components.raes))
  );
}
export const sectionStates: Record<
  string,
  { title: string; labels: Record<string, string> }
> = {
  profiles: {
    title: "Perfiles ciudadanos",
    labels: {
      PENDIENTE_VERIFICACION: "Pendiente de verificación",
      ACTIVO: "Activo",
      SUSPENDIDO: "Suspendido",
      CERRADO: "Cerrado",
    },
  },
  verifications: {
    title: "Verificación documental",
    labels: {
      PENDIENTE: "Pendiente",
      PROCESADA: "Procesada",
      APROBADA: "Aprobada",
      RECHAZADA: "Rechazada",
      REVISION: "En revisión",
    },
  },
  links: {
    title: "Vinculaciones RAES",
    labels: {
      PENDIENTE: "Pendiente",
      VERIFICADA: "Verificada",
      RECHAZADA: "Rechazada",
      REVOCADA: "Revocada",
    },
  },
  shares: {
    title: "Comparticiones",
    labels: { ACTIVA: "Activa", REVOCADA: "Revocada", EXPIRADA: "Expirada" },
  },
};
export function adminReturnPath(value: unknown) {
  return typeof value === "string" &&
    (value === "/admin" ||
      /^\/admin\/(users|verifications|links|shares|health)$/.test(value))
    ? value
    : "/admin";
}
