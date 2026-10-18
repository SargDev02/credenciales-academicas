import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SourceConfig = { supabaseUrl: string; serviceRoleKey: string };

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
  estudiante_id: string;
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
  env: SourceConfig,
): SupabaseClient {
  return createClient(
    env.supabaseUrl,
    env.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

const PAGE_SIZE = 1000;
async function readAll<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error(`No fue posible leer ${table} desde la institución`);
    rows.push(...data as unknown as T[]);
    if (data.length < PAGE_SIZE) return rows;
  }
}
export async function readInstitutionalSnapshot(client: SupabaseClient): Promise<InstitutionalSnapshot> {
  const { data: institutions, error } = await client.from("institucion")
    .select("nit,codigo_snies,nombre,tipo_institucion,estado").limit(2);
  if (error || institutions?.length !== 1) throw new Error("La fuente debe contener exactamente una institución");
  const [campuses, programs, programCampuses, students, enrollments, credentials] = await Promise.all([
    readAll<CampusRow>(client, "sedes", "id,codigo,nombre,departamento,municipio,direccion,estado"),
    readAll<ProgramRow>(client, "programas", "id,codigo_interno,codigo_snies,nombre,nivel_formacion,modalidad,facultad,estado"),
    readAll<ProgramCampusRow>(client, "programa_sede", "id,programa_id,sede_id,jornada,modalidad,estado"),
    readAll<StudentRow>(client, "estudiantes", "id,tipo_documento,numero_documento,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido"),
    readAll<EnrollmentRow>(client, "matriculas", "id,programa_sede_id,estudiante_id"),
    readAll<CredentialRow>(client, "credenciales", "id,estudiante_id,matricula_id,codigo,tipo,titulo,descripcion,fecha_emision,fecha_grado,numero_acta,numero_folio,numero_libro,hash_documento,estado,created_at,updated_at"),
  ]);
  return { institution: institutions[0] as InstitutionRow, campuses, programs, programCampuses, students, enrollments, credentials };
}
