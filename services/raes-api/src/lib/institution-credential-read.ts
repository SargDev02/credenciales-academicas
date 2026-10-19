import type { InstitutionalIdentity } from "./institution-auth";
import { ApiError } from "./api-error";
import { getRaesSupabaseAdmin } from "./supabase-admin";

// Returns only this institution's current projection for connector reconciliation.
export async function getInstitutionCredentialState(identity: InstitutionalIdentity, code: string) {
  const db = getRaesSupabaseAdmin();
  const { data: credential, error } = await db.from("credenciales")
    .select("id,persona_id,codigo_origen,estado_actual,version_actual,programas(codigo_origen),sedes(codigo_origen)")
    .eq("institucion_id", identity.institutionId).eq("codigo_origen", code).maybeSingle();
  if (error) throw new ApiError(500, "CREDENTIAL_LOOKUP_FAILED", "No fue posible consultar la credencial institucional");
  if (!credential) throw new ApiError(404, "CREDENTIAL_NOT_FOUND", "La credencial no existe para esta institución");
  const [version, creation, sources] = await Promise.all([
    db.from("credencial_versiones")
      .select("tipo,categoria,titulo,descripcion,fecha_emision,fecha_grado,numero_acta,numero_folio,numero_libro,documento_hash_sha256")
      .eq("credencial_id", credential.id).eq("numero_version", credential.version_actual).single(),
    db.from("operaciones_api").select("idempotency_key")
      .eq("credencial_id", credential.id).eq("integracion_id", identity.integrationId)
      .eq("tipo_operacion", "CREDENTIAL_CREATE").maybeSingle(),
    db.from("persona_fuentes").select("identificador_origen")
      .eq("institucion_id", identity.institutionId).eq("persona_id", credential.persona_id),
  ]);
  if (version.error || !version.data || creation.error || sources.error) {
    throw new ApiError(500, "CREDENTIAL_STATE_FAILED", "No fue posible obtener el estado vigente");
  }
  const program = one(credential.programas);
  const campus = one(credential.sedes);
  const v = version.data;
  return {
    state: credential.estado_actual,
    version: credential.version_actual,
    creationKey: creation.data?.idempotency_key ?? null,
    personSourceIds: (sources.data ?? []).map(s => s.identificador_origen),
    payload: {
      codigoOrigen: credential.codigo_origen,
      programaCodigoOrigen: program?.codigo_origen ?? null,
      sedeCodigoOrigen: campus?.codigo_origen ?? null,
      tipo: v.tipo, categoria: v.categoria, titulo: v.titulo,
      descripcion: v.descripcion, fechaEmision: v.fecha_emision, fechaGrado: v.fecha_grado,
      numeroActa: v.numero_acta, numeroFolio: v.numero_folio, numeroLibro: v.numero_libro,
      documentoHashSha256: v.documento_hash_sha256,
    },
  };
}
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
