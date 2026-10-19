import { getRaesSupabaseAdmin } from "./supabase-admin";

type CredentialRow = {
  id: string;
  codigo_raes: string;
  tipo: string;
  categoria: string;
  estado_actual: string;
  version_actual: number;
  fecha_registro_raes: string;
  revocada_at: string | null;
  motivo_revocacion: string | null;
  anulada_at: string | null;
  motivo_anulacion: string | null;
  instituciones:
    | { id: string; nombre: string; nit: string }
    | { id: string; nombre: string; nit: string }[]
    | null;
  programas:
    | { id: string; nombre: string; codigo_snies: string | null }
    | { id: string; nombre: string; codigo_snies: string | null }[]
    | null;
  sedes:
    | { id: string; nombre: string; municipio: string | null }
    | { id: string; nombre: string; municipio: string | null }[]
    | null;
};

type CredentialVersionRow = {
  credencial_id: string;
  numero_version: number;
  tipo: string;
  categoria: string;
  titulo: string;
  descripcion: string | null;
  fecha_emision: string;
  fecha_grado: string | null;
  estado_reportado: string;
  numero_acta: string | null;
  numero_folio: string | null;
  numero_libro: string | null;
  created_at: string;
};

export class ConsumerReadError extends Error {
  constructor(
    public readonly status: 404 | 500,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConsumerReadError";
  }
}

export async function resolvePersonByDocument(input: {
  tipoDocumento: string;
  numeroDocumento: string;
}) {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("personas_maestra")
    .select(
      "id,tipo_documento,numero_documento,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido",
    )
    .eq("tipo_documento", input.tipoDocumento)
    .eq("numero_documento", input.numeroDocumento)
    .maybeSingle();

  if (error) {
    throw new ConsumerReadError(
      500,
      "PERSON_RESOLVE_FAILED",
      "No fue posible resolver la persona en RAES",
    );
  }

  if (!data) {
    throw new ConsumerReadError(
      404,
      "PERSON_NOT_FOUND",
      "No existe una persona con esa identidad en RAES",
    );
  }

  return data;
}

export async function listCredentialsForPerson(
  personId: string,
) {
  const supabase = getRaesSupabaseAdmin();

  const { data: person, error: personError } = await supabase
    .from("personas_maestra")
    .select("id")
    .eq("id", personId)
    .maybeSingle();

  if (personError) {
    throw new ConsumerReadError(
      500,
      "PERSON_LOOKUP_FAILED",
      "No fue posible consultar la persona en RAES",
    );
  }

  if (!person) {
    throw new ConsumerReadError(
      404,
      "PERSON_NOT_FOUND",
      "La persona indicada no existe en RAES",
    );
  }

  const credentialRows: CredentialRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("credenciales")
      .select(
        [
          "id",
          "codigo_raes",
          "tipo",
          "categoria",
          "estado_actual",
          "version_actual",
          "fecha_registro_raes",
          "revocada_at",
          "motivo_revocacion",
          "anulada_at",
          "motivo_anulacion",
          "instituciones(id,nombre,nit)",
          "programas(id,nombre,codigo_snies)",
          "sedes(id,nombre,municipio)",
        ].join(","),
      )
      .eq("persona_id", personId)
      .order("fecha_registro_raes", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 999);
    if (error || !data) throw new ConsumerReadError(500, "CREDENTIAL_LIST_FAILED", "No fue posible consultar las credenciales en RAES");
    credentialRows.push(...data as unknown as CredentialRow[]);
    if (data.length < 1000) break;
  }

  const credentialIds = credentialRows.map(
    (credential) => credential.id,
  );

  if (credentialIds.length === 0) {
    return [];
  }

  const versionRows: CredentialVersionRow[] = [];
  // Fetch only each current version in bounded batches; old history must not
  // consume the PostgREST row limit or hide another credential's current version.
  for (let offset = 0; offset < credentialRows.length; offset += 50) {
    const batch = credentialRows.slice(offset, offset + 50);
    const { data, error } = await supabase.from("credencial_versiones")
    .select(
      [
        "credencial_id",
        "numero_version",
        "tipo",
        "categoria",
        "titulo",
        "descripcion",
        "fecha_emision",
        "fecha_grado",
        "estado_reportado",
        "numero_acta",
        "numero_folio",
        "numero_libro",
        "created_at",
      ].join(","),
    )
      .in("credencial_id", batch.map(c => c.id))
      .or(batch.map(c => `and(credencial_id.eq.${c.id},numero_version.eq.${c.version_actual})`).join(","));
    if (error || !data) throw new ConsumerReadError(500, "CREDENTIAL_VERSION_LIST_FAILED", "No fue posible consultar las versiones actuales");
    versionRows.push(...data as unknown as CredentialVersionRow[]);
  }

  return credentialRows.map((credential) => {
    const currentVersion = versionRows.find(
      (version) =>
        version.credencial_id === credential.id &&
        version.numero_version === credential.version_actual,
    );

    if (!currentVersion) throw new ConsumerReadError(500, "CREDENTIAL_CURRENT_VERSION_MISSING", "No fue posible obtener la versión vigente de una credencial");
    return {
      ...credential,
      currentVersion,
    };
  });
}

export function consumerReadErrorResponse(
  error: unknown,
): Response {
  if (error instanceof ConsumerReadError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    );
  }

  console.error("Unexpected RAES consumer read error");

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error inesperado",
    },
    { status: 500 },
  );
}
