import { record } from "./citizen-model";
export const visibleFields = [
  { value: "programa", label: "Programa" },
  { value: "sede", label: "Sede" },
  { value: "descripcion", label: "Descripción" },
  { value: "fechaGrado", label: "Fecha de grado" },
  { value: "numeroActa", label: "Número de acta" },
  { value: "numeroFolio", label: "Número de folio" },
  { value: "numeroLibro", label: "Número de libro" },
  { value: "motivoEstado", label: "Motivo del estado" },
] as const;
export type Share = {
  id: string;
  raesCredencialId: string;
  tokenPrefix: string;
  camposVisibles: string[];
  expiresAt: string;
  revokedAt: string | null;
  estado: "ACTIVA" | "REVOCADA" | "EXPIRADA";
  createdAt: string;
};
export function isShare(v: unknown): v is Share {
  return (
    record(v) &&
    ["id", "raesCredencialId", "tokenPrefix", "expiresAt", "createdAt"].every(
      (k) => typeof v[k] === "string",
    ) &&
    ["ACTIVA", "REVOCADA", "EXPIRADA"].includes(String(v.estado)) &&
    (v.revokedAt === null || typeof v.revokedAt === "string") &&
    Array.isArray(v.camposVisibles) &&
    v.camposVisibles.every((s) => typeof s === "string")
  );
}
export const isShares = (v: unknown): v is { data: Share[] } =>
  record(v) && Array.isArray(v.data) && v.data.every(isShare);
export const isRevokedShare = (v: unknown): v is { data: Share } =>
  record(v) && isShare(v.data);
export const validShareToken = (v: string) =>
  /^crdn_shr_[A-Za-z0-9_-]{40,50}$/.test(v);
export function isCreatedShare(
  v: unknown,
): v is { data: Share & { token: string; tokenReturnedOnce: true } } {
  if (!record(v) || !record(v.data)) return false;
  const { token, tokenReturnedOnce } = v.data;
  return (
    isShare(v.data) &&
    typeof token === "string" &&
    validShareToken(token) &&
    tokenReturnedOnce === true
  );
}
export function prepareShare(form: FormData) {
  const id = form.get("raesCredencialId"),
    hours = Number(form.get("expiresInHours")),
    fields = form.getAll("camposVisibles");
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 720 ||
    fields.length > 8 ||
    fields.some(
      (f) =>
        typeof f !== "string" ||
        !visibleFields.some((allowed) => allowed.value === f),
    )
  )
    throw new Error(
      "Revisa la credencial, los campos y una duración entre 1 y 720 horas.",
    );
  return {
    raesCredencialId: id,
    expiresInHours: hours,
    camposVisibles: [...new Set(fields)],
  };
}
export type PublicCredential = {
  codigoRaes: string;
  tipo: string;
  categoria: string;
  estadoActual: "VIGENTE" | "REVOCADA" | "ANULADA";
  versionActual: number;
  institucion: { nombre: string; nit: string } | null;
  titulo: string | null;
  fechaEmision: string | null;
  programa?: { nombre: string } | null;
  sede?: { nombre: string; municipio: string | null } | null;
  descripcion?: string | null;
  fechaGrado?: string | null;
  numeroActa?: string | null;
  numeroFolio?: string | null;
  numeroLibro?: string | null;
  motivoEstado?: string | null;
  fechaEstadoTerminal: string | null;
};
export type PublicVerification = {
  share: { id: string; expiresAt: string };
  credential: PublicCredential;
  source: "RAES";
  persistedByCredenly: false;
  verifiedAt: string;
};
export function isPublicVerification(
  value: unknown,
): value is { data: PublicVerification } {
  if (!record(value) || !record(value.data)) return false;
  const {
    share,
    credential: c,
    source,
    persistedByCredenly,
    verifiedAt,
  } = value.data;
  if (
    source !== "RAES" ||
    persistedByCredenly !== false ||
    typeof verifiedAt !== "string" ||
    !record(share) ||
    typeof share.id !== "string" ||
    typeof share.expiresAt !== "string" ||
    !record(c) ||
    !["codigoRaes", "tipo", "categoria"].every(
      (k) => typeof c[k] === "string",
    ) ||
    !Number.isInteger(c.versionActual) ||
    !["VIGENTE", "REVOCADA", "ANULADA"].includes(String(c.estadoActual))
  )
    return false;
  for (const key of ["titulo", "fechaEmision", "fechaEstadoTerminal"])
    if (c[key] !== null && typeof c[key] !== "string") return false;
  for (const key of ["institucion", "programa", "sede"]) {
    const nested = c[key];
    if (
      nested !== null &&
      nested !== undefined &&
      (!record(nested) || typeof nested.nombre !== "string")
    )
      return false;
  }
  return [
    "descripcion",
    "fechaGrado",
    "numeroActa",
    "numeroFolio",
    "numeroLibro",
    "motivoEstado",
  ].every((k) => c[k] == null || typeof c[k] === "string");
}
export function publicError(status: number, code: string) {
  if (status === 410 && code === "SHARE_REVOKED")
    return {
      title: "Enlace revocado",
      message: "La persona que compartió esta credencial retiró el acceso.",
    };
  if (status === 410 && code === "SHARE_EXPIRED")
    return {
      title: "Enlace expirado",
      message:
        "El tiempo de acceso terminó. Solicita un nuevo enlace a su titular.",
    };
  if (status === 410)
    return {
      title: "Enlace no disponible",
      message: "Este enlace ya no permite consultar información.",
    };
  if (status === 404)
    return {
      title: "Información no disponible",
      message:
        "No encontramos un enlace o una credencial disponible para esta consulta.",
    };
  return {
    title: "No pudimos consultar RAES",
    message:
      "El servicio no está disponible en este momento. Intenta de nuevo más tarde.",
  };
}
