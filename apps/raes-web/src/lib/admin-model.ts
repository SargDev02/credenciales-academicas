import type { Tone } from "@raes/ui";
export type Institution = {
  id: string;
  nit: string;
  codigoSnies: string | null;
  nombre: string;
  tipoInstitucion: string;
  estado: "ACTIVA" | "INACTIVA" | "SUSPENDIDA";
  createdAt: string;
  updatedAt: string;
};
export type ApiClient = {
  id: string;
  nombre: string;
  tipoCliente: string;
  clientId: string;
  estado: "ACTIVO" | "SUSPENDIDO" | "REVOCADO";
  ultimoUsoAt: string | null;
  createdAt: string;
  updatedAt: string;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === "string");
export function isInstitutions(v: unknown): v is { data: Institution[] } {
  return (
    record(v) &&
    Array.isArray(v.data) &&
    v.data.every(
      (i) =>
        record(i) &&
        strings(i, [
          "id",
          "nit",
          "nombre",
          "tipoInstitucion",
          "createdAt",
          "updatedAt",
        ]) &&
        (typeof i.codigoSnies === "string" || i.codigoSnies === null) &&
        ["ACTIVA", "INACTIVA", "SUSPENDIDA"].includes(String(i.estado)),
    )
  );
}
export function isClients(v: unknown): v is { data: ApiClient[] } {
  return (
    record(v) &&
    Array.isArray(v.data) &&
    v.data.every(
      (i) =>
        record(i) &&
        strings(i, [
          "id",
          "nombre",
          "tipoCliente",
          "clientId",
          "createdAt",
          "updatedAt",
        ]) &&
        (typeof i.ultimoUsoAt === "string" || i.ultimoUsoAt === null) &&
        ["ACTIVO", "SUSPENDIDO", "REVOCADO"].includes(String(i.estado)),
    )
  );
}
export function statusLabel(value: string): string {
  return (
    (
      {
        ACTIVA: "Activa",
        INACTIVA: "Inactiva",
        SUSPENDIDA: "Suspendida",
        ACTIVO: "Activo",
        SUSPENDIDO: "Suspendido",
        REVOCADO: "Revocado",
      } as Record<string, string>
    )[value] ?? value
  );
}
export function statusTone(value: string): Tone {
  return value === "ACTIVA" || value === "ACTIVO"
    ? "success"
    : value === "REVOCADO"
      ? "danger"
      : "warning";
}
export function formatDate(value: string | null): string {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeZone: "America/Bogota",
      }).format(date);
}
export function filterRecords<T extends { nombre: string; estado: string }>(
  rows: T[],
  query: unknown,
  state: unknown,
): T[] {
  const needle =
    typeof query === "string" ? query.trim().toLocaleLowerCase("es") : "";
  return rows.filter(
    (i) =>
      (!needle || i.nombre.toLocaleLowerCase("es").includes(needle)) &&
      (typeof state !== "string" || state === "" || i.estado === state),
  );
}

export type AdminProfile = {
  id: string;
  nombres: string;
  apellidos: string;
  rol: "SUPERADMIN" | "ADMIN" | "AUDITOR";
  estado: "ACTIVO";
};
export function isAdminProfile(v: unknown): v is { data: AdminProfile } {
  return record(v) && record(v.data) &&
    strings(v.data, ["id", "nombres", "apellidos"]) &&
    ["SUPERADMIN", "ADMIN", "AUDITOR"].includes(String(v.data.rol)) &&
    v.data.estado === "ACTIVO";
}
export function canManage(profile: AdminProfile): boolean {
  return profile.estado === "ACTIVO" &&
    (profile.rol === "SUPERADMIN" || profile.rol === "ADMIN");
}
