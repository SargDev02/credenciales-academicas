export const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string";
const nullable = (v: unknown): v is string | null => v === null || string(v);
export type Profile = {
  id: string;
  nombres: string | null;
  apellidos: string | null;
  estado: string;
};
export type Verification = {
  id: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  nombres: string | null;
  apellidos: string | null;
  estado: "PENDIENTE" | "PROCESADA" | "APROBADA" | "RECHAZADA" | "REVISION";
  motivoFallo: string | null;
  motivoRevision: string | null;
  canLinkRaes: boolean;
};
export type RaesLink = {
  id: string;
  raesPersonaId: string;
  verificacionIdentidadId: string;
  estado: "PENDIENTE" | "VERIFICADA" | "RECHAZADA" | "REVOCADA";
};
export type Credential = {
  id: string;
  codigoRaes: string;
  tipo: string;
  categoria: string;
  estadoActual: "VIGENTE" | "REVOCADA" | "ANULADA";
  versionActual: number;
  revocadaAt: string | null;
  motivoRevocacion: string | null;
  anuladaAt: string | null;
  motivoAnulacion: string | null;
  institucion: { id: string; nit: string; nombre: string } | null;
  programa: { id: string; nombre: string; codigo_snies: string | null } | null;
  sede: { id: string; nombre: string; municipio: string | null } | null;
  version: {
    numeroVersion: number;
    titulo: string;
    descripcion: string | null;
    fechaEmision: string;
    fechaGrado: string | null;
    estadoReportado: string;
    numeroActa: string | null;
    numeroFolio: string | null;
    numeroLibro: string | null;
  } | null;
};
export const isProfile = (v: unknown): v is { data: Profile | null } =>
  record(v) &&
  (v.data === null ||
    (record(v.data) &&
      string(v.data.id) &&
      nullable(v.data.nombres) &&
      nullable(v.data.apellidos) &&
      string(v.data.estado)));
export const isVerification = (
  v: unknown,
): v is { data: Verification | null } =>
  record(v) &&
  (v.data === null ||
    (record(v.data) &&
      string(v.data.id) &&
      ["PENDIENTE", "PROCESADA", "APROBADA", "RECHAZADA", "REVISION"].includes(
        String(v.data.estado),
      ) &&
      [
        "tipoDocumento",
        "numeroDocumento",
        "nombres",
        "apellidos",
        "motivoFallo",
        "motivoRevision",
      ].every((k) => nullable((v.data as Record<string, unknown>)[k])) &&
      typeof v.data.canLinkRaes === "boolean"));
export const isLink = (v: unknown): v is { data: RaesLink | null } =>
  record(v) &&
  (v.data === null ||
    (record(v.data) &&
      ["id", "raesPersonaId", "verificacionIdentidadId"].every((k) =>
        string((v.data as Record<string, unknown>)[k]),
      ) &&
      ["PENDIENTE", "VERIFICADA", "RECHAZADA", "REVOCADA"].includes(
        String(v.data.estado),
      )));
export function isCredential(v: unknown): v is Credential {
  if (
    !record(v) ||
    !["id", "codigoRaes", "tipo", "categoria"].every((k) => string(v[k])) ||
    !["VIGENTE", "REVOCADA", "ANULADA"].includes(String(v.estadoActual)) ||
    !Number.isInteger(v.versionActual)
  )
    return false;
  if (
    !["revocadaAt", "motivoRevocacion", "anuladaAt", "motivoAnulacion"].every(
      (k) => nullable(v[k]),
    )
  )
    return false;
  for (const key of ["institucion", "programa", "sede"]) {
    const field = v[key];
    if (
      field !== null &&
      (!record(field) || !string(field.id) || !string(field.nombre))
    )
      return false;
  }
  const version = v.version;
  return (
    version === null ||
    (record(version) &&
      string(version.titulo) &&
      string(version.fechaEmision) &&
      [
        "descripcion",
        "fechaGrado",
        "numeroActa",
        "numeroFolio",
        "numeroLibro",
      ].every((k) => nullable(version[k])))
  );
}
export function isCredentials(
  v: unknown,
): v is { data: Credential[]; source: "RAES"; persistedByCredenly: false } {
  return (
    record(v) &&
    v.source === "RAES" &&
    v.persistedByCredenly === false &&
    Array.isArray(v.data) &&
    v.data.every(isCredential)
  );
}
export function onboardingStep(
  profile: Profile | null,
  verification: Verification | null,
  link: RaesLink | null,
): number {
  if (!profile?.nombres || !profile.apellidos) return 1;
  if (!verification) return 2;
  if (verification.estado !== "APROBADA") return 3;
  if (link?.estado !== "VERIFICADA") return 4;
  return 5;
}
export function date(value: string | null | undefined): string {
  if (!value) return "No informada";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "No disponible"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "America/Bogota",
      }).format(parsed);
}
export function statusText(state: string) {
  return (
    (
      {
        VIGENTE: "Vigente",
        REVOCADA: "Revocada",
        ANULADA: "Anulada",
        ACTIVA: "Activa",
        EXPIRADA: "Expirada",
        APROBADA: "Aprobada",
        PENDIENTE: "Pendiente",
        PROCESADA: "Procesada",
        RECHAZADA: "Rechazada",
        REVISION: "En revisión",
      } as Record<string, string>
    )[state] ?? state
  );
}
