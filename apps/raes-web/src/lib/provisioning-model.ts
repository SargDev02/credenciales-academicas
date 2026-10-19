import { isInstitutions } from "./admin-model";

export type CreationKind = "institution" | "client" | "integration";
export type CreationResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
  credentials?: { clientId: string; clientSecret: string; scopes: string[] };
};
export type PreparedCreation = { path: string; body: Record<string, unknown> };
export function prepareCreation(
  kind: CreationKind,
  form: FormData,
): PreparedCreation {
  const errors: Record<string, string> = {};
  function text(key: string, min: number, max: number, optional = false) {
    const raw = form.get(key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if ((!optional || value) && (value.length < min || value.length > max))
      errors[key] = `Usa entre ${min} y ${max} caracteres.`;
    return value;
  }
  function scopes(optional: boolean) {
    const raw = text("scopes", 1, 2000, optional);
    if (!raw && optional) return undefined;
    const values = [
      ...new Set(
        raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !values.length ||
      values.length > 20 ||
      values.some((v) => !/^[a-z]+:[a-z]+$/.test(v) || v.length > 80)
    )
      errors.scopes =
        "Escribe uno o más permisos separados por comas (recurso:acción).";
    return values;
  }
  let prepared: PreparedCreation;
  if (kind === "institution") {
    const nit = text("nit", 3, 40);
    const nombre = text("nombre", 2, 200);
    const tipoInstitucion = text("tipoInstitucion", 2, 80);
    const codigoSnies = text("codigoSnies", 1, 40, true);
    // New records start active, matching the endpoint's existing default.
    prepared = {
      path: "/api/v1/admin/institutions",
      body: {
        nit,
        nombre,
        tipoInstitucion,
        ...(codigoSnies ? { codigoSnies } : {}),
      },
    };
  } else if (kind === "client" || kind === "integration") {
    const nombre = text("nombre", 2, 160);
    const requested = scopes(kind === "integration");
    if (kind === "client") {
      const tipoCliente = text("tipoCliente", 2, 40);
      if (
        !["CREDENLY", "VERIFICADOR", "GOBERNACION", "OTRO"].includes(
          tipoCliente,
        )
      )
        errors.tipoCliente = "Selecciona un tipo de cliente admitido.";
      prepared = {
        path: "/api/v1/admin/api-clients",
        body: { nombre, tipoCliente, scopes: requested },
      };
    } else {
      const institutionId = text("institutionId", 36, 36);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          institutionId,
        )
      )
        errors.institutionId = "La institución no es válida.";
      prepared = {
        path: `/api/v1/admin/institutions/${institutionId}/integrations`,
        body: { nombre, ...(requested ? { scopes: requested } : {}) },
      };
    }
  } else throw new CreationValidationError({ form: "Operación no admitida." });
  if (Object.keys(errors).length) throw new CreationValidationError(errors);
  return prepared;
}
export class CreationValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Revisa los campos indicados.");
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export type Provisioned = {
  data: {
    client?: { id: string };
    integration?: { id: string };
    scopes: string[];
    credentials: { clientId: string; clientSecret: string };
  };
};
export function isProvisioned(value: unknown): value is Provisioned {
  if (!record(value) || !record(value.data)) return false;
  const { credentials, scopes, client, integration } = value.data;
  const entity = client ?? integration;
  return (
    record(entity) &&
    typeof entity.id === "string" &&
    record(credentials) &&
    typeof credentials.clientId === "string" &&
    typeof credentials.clientSecret === "string" &&
    Array.isArray(scopes) &&
    scopes.every((s) => typeof s === "string")
  );
}
export function isCreatedInstitution(
  value: unknown,
): value is { data: { id: string } } {
  return record(value) && isInstitutions({ data: [value.data] });
}
