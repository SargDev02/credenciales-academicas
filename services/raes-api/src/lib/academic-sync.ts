import type {
  Institucion,
  Persona,
  Programa,
  Sede,
} from "@raes/contracts";

import { ApiError } from "./api-error";
import type { InstitutionalIdentity } from "./institution-auth";
import { getRaesSupabaseAdmin } from "./supabase-admin";

type InstitutionRow = {
  id: string;
  nit: string;
  codigo_snies: string | null;
  nombre: string;
  tipo_institucion: string;
  estado: string;
};

type CampusRow = {
  id: string;
  codigo_origen: string;
};

type ProgramRow = {
  id: string;
  codigo_origen: string;
};

type PersonMasterRow = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
};

type PersonSourceRow = {
  id: string;
  persona_id: string;
};

export async function syncInstitution(
  identity: InstitutionalIdentity,
  input: Institucion,
): Promise<InstitutionRow> {
  const supabase = getRaesSupabaseAdmin();

  const { data: currentData, error: currentError } = await supabase
    .from("instituciones")
    .select("id,nit,codigo_snies,nombre,tipo_institucion,estado")
    .eq("id", identity.institutionId)
    .maybeSingle();

  if (currentError) {
    throwDatabaseError("consultar la institución", currentError.code);
  }

  const current = currentData as InstitutionRow | null;

  if (!current) {
    throw new ApiError(
      404,
      "INSTITUTION_NOT_FOUND",
      "La institución asociada a la integración no existe",
    );
  }

  if (current.nit !== input.nit) {
    throw new ApiError(
      409,
      "INSTITUTION_IDENTITY_MISMATCH",
      "El NIT reportado no coincide con la institución autenticada",
    );
  }

  const { data, error } = await supabase
    .from("instituciones")
    .update({
      codigo_snies: input.codigoSnies ?? null,
      nombre: input.nombre,
      tipo_institucion: input.tipoInstitucion,
      estado: input.estado,
    })
    .eq("id", identity.institutionId)
    .select("id,nit,codigo_snies,nombre,tipo_institucion,estado")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        409,
        "INSTITUTION_UNIQUENESS_CONFLICT",
        "El código SNIES reportado ya está asociado a otra institución",
      );
    }

    throwDatabaseError("actualizar la institución", error.code);
  }

  return data as InstitutionRow;
}

export async function syncCampus(
  identity: InstitutionalIdentity,
  input: Sede,
): Promise<CampusRow> {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("sedes")
    .upsert(
      {
        institucion_id: identity.institutionId,
        codigo_origen: input.codigoOrigen,
        nombre: input.nombre,
        departamento: input.departamento ?? null,
        municipio: input.municipio ?? null,
        direccion: input.direccion ?? null,
        estado: input.estado,
      },
      {
        onConflict: "institucion_id,codigo_origen",
      },
    )
    .select("id,codigo_origen")
    .single();

  if (error) {
    throwDatabaseError("sincronizar la sede", error.code);
  }

  return data as CampusRow;
}

export async function syncProgram(
  identity: InstitutionalIdentity,
  input: Programa,
): Promise<ProgramRow> {
  const supabase = getRaesSupabaseAdmin();

  const { data, error } = await supabase
    .from("programas")
    .upsert(
      {
        institucion_id: identity.institutionId,
        codigo_origen: input.codigoOrigen,
        codigo_snies: input.codigoSnies ?? null,
        nombre: input.nombre,
        nivel_formacion: input.nivelFormacion ?? null,
        modalidad: input.modalidad ?? null,
        facultad: input.facultad ?? null,
        estado: input.estado,
      },
      {
        onConflict: "institucion_id,codigo_origen",
      },
    )
    .select("id,codigo_origen")
    .single();

  if (error) {
    throwDatabaseError("sincronizar el programa", error.code);
  }

  return data as ProgramRow;
}

export async function syncPerson(
  identity: InstitutionalIdentity,
  input: Persona,
): Promise<{
  personId: string;
  sourceId: string;
  matchedExistingMaster: boolean;
}> {
  const supabase = getRaesSupabaseAdmin();

  const { data: sourceData, error: sourceError } = await supabase
    .from("persona_fuentes")
    .select("id,persona_id")
    .eq("institucion_id", identity.institutionId)
    .eq("identificador_origen", input.identificadorOrigen)
    .maybeSingle();

  if (sourceError) {
    throwDatabaseError(
      "consultar la referencia institucional de la persona",
      sourceError.code,
    );
  }

  const existingSource = sourceData as PersonSourceRow | null;

  if (existingSource) {
    const { data: linkedMasterData, error: linkedMasterError } =
      await supabase
        .from("personas_maestra")
        .select("id,tipo_documento,numero_documento")
        .eq("id", existingSource.persona_id)
        .single();

    if (linkedMasterError) {
      throwDatabaseError(
        "consultar la persona maestra vinculada",
        linkedMasterError.code,
      );
    }

    const linkedMaster = linkedMasterData as PersonMasterRow;

    if (
      linkedMaster.tipo_documento !== input.tipoDocumento ||
      linkedMaster.numero_documento !== input.numeroDocumento
    ) {
      throw new ApiError(
        409,
        "PERSON_SOURCE_IDENTITY_CONFLICT",
        "El identificador institucional ya está vinculado a otra identidad documental",
      );
    }

    const now = new Date().toISOString();

    const { error: updateSourceError } = await supabase
      .from("persona_fuentes")
      .update({
        tipo_documento_reportado: input.tipoDocumento,
        numero_documento_reportado: input.numeroDocumento,
        primer_nombre_reportado: input.primerNombre,
        segundo_nombre_reportado: input.segundoNombre ?? null,
        primer_apellido_reportado: input.primerApellido,
        segundo_apellido_reportado: input.segundoApellido ?? null,
        last_seen_at: now,
      })
      .eq("id", existingSource.id);

    if (updateSourceError) {
      throwDatabaseError(
        "actualizar la fuente institucional de la persona",
        updateSourceError.code,
      );
    }

    return {
      personId: linkedMaster.id,
      sourceId: existingSource.id,
      matchedExistingMaster: true,
    };
  }

  const { data: existingMasterData, error: masterLookupError } =
    await supabase
      .from("personas_maestra")
      .select("id,tipo_documento,numero_documento")
      .eq("tipo_documento", input.tipoDocumento)
      .eq("numero_documento", input.numeroDocumento)
      .maybeSingle();

  if (masterLookupError) {
    throwDatabaseError("resolver la persona maestra", masterLookupError.code);
  }

  let master = existingMasterData as PersonMasterRow | null;
  const matchedExistingMaster = master !== null;

  if (!master) {
    const { error: insertMasterError } = await supabase
      .from("personas_maestra")
      .upsert(
        {
          tipo_documento: input.tipoDocumento,
          numero_documento: input.numeroDocumento,
          primer_nombre: input.primerNombre,
          segundo_nombre: input.segundoNombre ?? null,
          primer_apellido: input.primerApellido,
          segundo_apellido: input.segundoApellido ?? null,
        },
        {
          onConflict: "tipo_documento,numero_documento",
          ignoreDuplicates: true,
        },
      );

    if (insertMasterError) {
      throwDatabaseError("crear la persona maestra", insertMasterError.code);
    }

    const { data: resolvedMasterData, error: resolvedMasterError } =
      await supabase
        .from("personas_maestra")
        .select("id,tipo_documento,numero_documento")
        .eq("tipo_documento", input.tipoDocumento)
        .eq("numero_documento", input.numeroDocumento)
        .single();

    if (resolvedMasterError) {
      throwDatabaseError(
        "resolver la persona maestra después de crearla",
        resolvedMasterError.code,
      );
    }

    master = resolvedMasterData as PersonMasterRow;
  }

  const now = new Date().toISOString();

  const { data: createdSourceData, error: createSourceError } =
    await supabase
      .from("persona_fuentes")
      .upsert(
        {
          persona_id: master.id,
          institucion_id: identity.institutionId,
          identificador_origen: input.identificadorOrigen,
          tipo_documento_reportado: input.tipoDocumento,
          numero_documento_reportado: input.numeroDocumento,
          primer_nombre_reportado: input.primerNombre,
          segundo_nombre_reportado: input.segundoNombre ?? null,
          primer_apellido_reportado: input.primerApellido,
          segundo_apellido_reportado: input.segundoApellido ?? null,
          last_seen_at: now,
        },
        {
          onConflict: "institucion_id,identificador_origen",
        },
      )
      .select("id,persona_id")
      .single();

  if (createSourceError) {
    throwDatabaseError(
      "registrar la fuente institucional de la persona",
      createSourceError.code,
    );
  }

  const createdSource = createdSourceData as PersonSourceRow;

  return {
    personId: createdSource.persona_id,
    sourceId: createdSource.id,
    matchedExistingMaster,
  };
}

function throwDatabaseError(action: string, databaseCode?: string): never {
  console.error("RAES academic synchronization failed", {
    action,
    databaseCode,
  });

  throw new ApiError(
    500,
    "DATABASE_ERROR",
    "No fue posible completar la sincronización académica",
  );
}
