import type {
  Institucion,
  Persona,
  Programa,
  ProgramaSede,
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

type ProgramCampusRow = {
  id: string;
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

  const current = currentData;

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

  return data;
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

  return data;
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

  return data;
}

export async function syncProgramCampus(
  identity: InstitutionalIdentity,
  input: ProgramaSede,
): Promise<ProgramCampusRow> {
  const supabase = getRaesSupabaseAdmin();

  const [{ data: programData, error: programError }, { data: campusData, error: campusError }] =
    await Promise.all([
      supabase
        .from("programas")
        .select("id")
        .eq("institucion_id", identity.institutionId)
        .eq("codigo_origen", input.programaCodigoOrigen)
        .maybeSingle(),
      supabase
        .from("sedes")
        .select("id")
        .eq("institucion_id", identity.institutionId)
        .eq("codigo_origen", input.sedeCodigoOrigen)
        .maybeSingle(),
    ]);

  if (programError) {
    throwDatabaseError("resolver el programa de la relación", programError.code);
  }

  if (campusError) {
    throwDatabaseError("resolver la sede de la relación", campusError.code);
  }

  if (!programData) {
    throw new ApiError(
      404,
      "PROGRAM_NOT_FOUND",
      "El programa reportado no existe para la institución autenticada",
    );
  }

  if (!campusData) {
    throw new ApiError(
      404,
      "CAMPUS_NOT_FOUND",
      "La sede reportada no existe para la institución autenticada",
    );
  }

  const { data, error } = await supabase
    .from("programa_sede")
    .upsert(
      {
        programa_id: programData.id,
        sede_id: campusData.id,
        jornada: input.jornada ?? null,
        modalidad: input.modalidad ?? null,
        estado: input.estado,
      },
      {
        onConflict: "programa_id,sede_id",
      },
    )
    .select("id")
    .single();

  if (error) {
    throwDatabaseError("sincronizar la relación programa-sede", error.code);
  }

  return data;
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

  const existingSource = sourceData;

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

    const linkedMaster = linkedMasterData;

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

  let master = existingMasterData;
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

    master = resolvedMasterData;
  }

  const now = new Date().toISOString();

  const { error: createSourceError } =
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
          ignoreDuplicates: true,
        },
      );

  if (createSourceError) {
    throwDatabaseError(
      "registrar la fuente institucional de la persona",
      createSourceError.code,
    );
  }

  // The unique source key is claimed by INSERT ... ON CONFLICT DO NOTHING.
  // Another request may have claimed it since the first lookup. Never upsert
  // persona_id: a concurrent conflicting document must not reassign identity.
  const { data: claimedSource, error: claimedSourceError } = await supabase
    .from("persona_fuentes")
    .select("id,persona_id")
    .eq("institucion_id", identity.institutionId)
    .eq("identificador_origen", input.identificadorOrigen)
    .single();

  if (claimedSourceError || !claimedSource) {
    throwDatabaseError("resolver la fuente institucional registrada", claimedSourceError?.code);
  }

  if (claimedSource.persona_id !== master.id) {
    throw new ApiError(
      409,
      "PERSON_SOURCE_IDENTITY_CONFLICT",
      "El identificador institucional ya está vinculado a otra identidad documental",
    );
  }

  return {
    personId: claimedSource.persona_id,
    sourceId: claimedSource.id,
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
