import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ConnectorEnv } from "./env";

export type InstitutionRow = {
  nit: string;
  codigo_snies: string | null;
  nombre: string;
  tipo_institucion: string;
  estado: string;
};

export type CampusRow = {
  id: string;
  codigo: string;
  nombre: string;
  departamento: string | null;
  municipio: string | null;
  direccion: string | null;
  estado: string;
};

export type ProgramRow = {
  id: string;
  codigo_interno: string;
  codigo_snies: string | null;
  nombre: string;
  nivel_formacion: string | null;
  modalidad: string | null;
  facultad: string | null;
  estado: string;
};

export type ProgramCampusRow = {
  id: string;
  programa_id: string;
  sede_id: string;
  jornada: string | null;
  modalidad: string | null;
  estado: string;
};

export type StudentRow = {
  id: string;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
};

export type EnrollmentRow = {
  id: string;
  programa_sede_id: string;
};

export type CredentialRow = {
  id: string;
  estudiante_id: string;
  matricula_id: string;
  codigo: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha_emision: string;
  fecha_grado: string | null;
  numero_acta: string | null;
  numero_folio: string | null;
  numero_libro: string | null;
  hash_documento: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
};

export type InstitutionalSnapshot = {
  institution: InstitutionRow;
  campuses: CampusRow[];
  programs: ProgramRow[];
  programCampuses: ProgramCampusRow[];
  students: StudentRow[];
  enrollments: EnrollmentRow[];
  credentials: CredentialRow[];
};

export function createInstitutionSourceClient(
  env: ConnectorEnv,
): SupabaseClient {
  return createClient(
    env.POLI_SUPABASE_URL,
    env.POLI_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function readInstitutionalSnapshot(
  client: SupabaseClient,
): Promise<InstitutionalSnapshot> {
  const [
    institutionResult,
    campusesResult,
    programsResult,
    programCampusesResult,
    studentsResult,
    enrollmentsResult,
    credentialsResult,
  ] = await Promise.all([
    client
      .from("institucion")
      .select("nit,codigo_snies,nombre,tipo_institucion,estado")
      .limit(1)
      .single(),
    client
      .from("sedes")
      .select("id,codigo,nombre,departamento,municipio,direccion,estado")
      .order("codigo"),
    client
      .from("programas")
      .select(
        "id,codigo_interno,codigo_snies,nombre,nivel_formacion,modalidad,facultad,estado",
      )
      .order("codigo_interno"),
    client
      .from("programa_sede")
      .select("id,programa_id,sede_id,jornada,modalidad,estado")
      .order("id"),
    client
      .from("estudiantes")
      .select(
        "id,tipo_documento,numero_documento,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido",
      )
      .order("id"),
    client
      .from("matriculas")
      .select("id,programa_sede_id")
      .order("id"),
    client
      .from("credenciales")
      .select(
        "id,estudiante_id,matricula_id,codigo,tipo,titulo,descripcion,fecha_emision,fecha_grado,numero_acta,numero_folio,numero_libro,hash_documento,estado,created_at,updated_at",
      )
      .order("created_at"),
  ]);

  assertQuery("institución", institutionResult.error);
  assertQuery("sedes", campusesResult.error);
  assertQuery("programas", programsResult.error);
  assertQuery("programa_sede", programCampusesResult.error);
  assertQuery("estudiantes", studentsResult.error);
  assertQuery("matriculas", enrollmentsResult.error);
  assertQuery("credenciales", credentialsResult.error);

  return {
    institution: institutionResult.data as InstitutionRow,
    campuses: (campusesResult.data ?? []) as CampusRow[],
    programs: (programsResult.data ?? []) as ProgramRow[],
    programCampuses:
      (programCampusesResult.data ?? []) as ProgramCampusRow[],
    students: (studentsResult.data ?? []) as StudentRow[],
    enrollments: (enrollmentsResult.data ?? []) as EnrollmentRow[],
    credentials: (credentialsResult.data ?? []) as CredentialRow[],
  };
}

function assertQuery(
  resource: string,
  error: { message: string } | null,
): void {
  if (error) {
    throw new Error(
      `No fue posible leer ${resource} desde Institución A: ${error.message}`,
    );
  }
}
