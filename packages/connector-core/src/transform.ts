import {
  credencialNuevaSchema,
  institucionSchema,
  personaSchema,
  programaSchema,
  programaSedeSchema,
  sedeSchema,
  type CredencialNueva,
  type Institucion,
  type Persona,
  type Programa,
  type ProgramaSede,
  type Sede,
} from "@raes/contracts";

import type {
  CampusRow,
  CredentialRow,
  InstitutionRow,
  ProgramCampusRow,
  ProgramRow,
  StudentRow,
} from "./source";

export function toInstitution(row: InstitutionRow): Institucion {
  return institucionSchema.parse({
    nit: row.nit,
    codigoSnies: row.codigo_snies,
    nombre: row.nombre,
    tipoInstitucion: row.tipo_institucion,
    estado: normalizeInstitutionState(row.estado),
  });
}

export function toCampus(row: CampusRow): Sede {
  return sedeSchema.parse({
    codigoOrigen: row.codigo,
    nombre: row.nombre,
    departamento: row.departamento,
    municipio: row.municipio,
    direccion: row.direccion,
    estado: normalizeInstitutionState(row.estado),
  });
}

export function toProgram(row: ProgramRow): Programa {
  return programaSchema.parse({
    codigoOrigen: row.codigo_interno,
    codigoSnies: row.codigo_snies,
    nombre: row.nombre,
    nivelFormacion: row.nivel_formacion,
    modalidad: row.modalidad,
    facultad: row.facultad,
    estado: normalizeAcademicState(row.estado),
  });
}

export function toProgramCampus(
  row: ProgramCampusRow,
  program: ProgramRow,
  campus: CampusRow,
): ProgramaSede {
  return programaSedeSchema.parse({
    programaCodigoOrigen: program.codigo_interno,
    sedeCodigoOrigen: campus.codigo,
    jornada: row.jornada,
    modalidad: row.modalidad,
    estado: normalizeAcademicState(row.estado),
  });
}

export function toPerson(row: StudentRow): Persona {
  return personaSchema.parse({
    identificadorOrigen: row.id,
    tipoDocumento: row.tipo_documento,
    numeroDocumento: row.numero_documento,
    primerNombre: row.primer_nombre,
    segundoNombre: row.segundo_nombre,
    primerApellido: row.primer_apellido,
    segundoApellido: row.segundo_apellido,
  });
}

export function toCredential(
  row: CredentialRow,
  student: StudentRow,
  program: ProgramRow,
  campus: CampusRow,
): CredencialNueva {
  return credencialNuevaSchema.parse({
    codigoOrigen: row.codigo,
    personaIdentificadorOrigen: student.id,
    programaCodigoOrigen: program.codigo_interno,
    sedeCodigoOrigen: campus.codigo,
    tipo: row.tipo,
    categoria: categoryForCredentialType(row.tipo),
    titulo: row.titulo,
    descripcion: row.descripcion,
    fechaEmision: row.fecha_emision,
    fechaGrado: row.fecha_grado,
    numeroActa: row.numero_acta,
    numeroFolio: row.numero_folio,
    numeroLibro: row.numero_libro,
    documentoHashSha256: row.hash_documento,
  });
}

export function normalizeCredentialState(
  value: string,
): "VIGENTE" | "REVOCADA" | "ANULADA" {
  const normalized = value.trim().toUpperCase();

  if (normalized === "VIGENTE") {
    return "VIGENTE";
  }

  if (normalized === "REVOCADO" || normalized === "REVOCADA") {
    return "REVOCADA";
  }

  if (normalized === "ANULADO" || normalized === "ANULADA") {
    return "ANULADA";
  }

  throw new Error(`Estado de credencial institucional no soportado: ${value}`);
}

function normalizeInstitutionState(
  value: string,
): "ACTIVA" | "INACTIVA" | "SUSPENDIDA" {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "ACTIVA" ||
    normalized === "INACTIVA" ||
    normalized === "SUSPENDIDA"
  ) {
    return normalized;
  }

  throw new Error(`Estado institucional no soportado: ${value}`);
}

function normalizeAcademicState(
  value: string,
): "ACTIVO" | "INACTIVO" | "SUSPENDIDO" {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "ACTIVO" ||
    normalized === "INACTIVO" ||
    normalized === "SUSPENDIDO"
  ) {
    return normalized;
  }

  throw new Error(`Estado académico no soportado: ${value}`);
}

function categoryForCredentialType(
  value: string,
): "TITULO" | "CURSO" | "CERTIFICACION" | "OTRO" {
  switch (value.trim().toUpperCase()) {
    case "DIPLOMA":
    case "ACTA_GRADO":
      return "TITULO";
    case "CERTIFICADO_CURSO":
      return "CURSO";
    case "CERTIFICADO_ESTUDIOS":
    case "CONSTANCIA":
      return "CERTIFICACION";
    default:
      return "OTRO";
  }
}
