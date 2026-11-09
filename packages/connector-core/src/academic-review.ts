import { academicObservationSchema, type AcademicObservation } from "@raes/contracts";
import type { InstitutionalSnapshot } from "./source";
import { toCredential, toPerson, toProgram, toCampus, toProgramCampus, normalizeCredentialState } from "./transform";

export function buildAcademicObservations(snapshot: InstitutionalSnapshot, credentialCode: string | null = null): AcademicObservation[] {
  const programs = new Map(snapshot.programs.map(v => [v.id, v]));
  const campuses = new Map(snapshot.campuses.map(v => [v.id, v]));
  const relations = new Map(snapshot.programCampuses.map(v => [v.id, v]));
  const enrollments = new Map(snapshot.enrollments.map(v => [v.id, v]));
  const students = new Map(snapshot.students.map(v => [v.id, v]));
  const grouped = new Map<string, AcademicObservation>();
  for (const student of snapshot.students) grouped.set(student.id, {
    persona: toPerson(student), sourceUpdatedAt: student.updated_at ?? null, credenciales: [],
  });
  if (credentialCode && !snapshot.credentials.some(v => v.codigo === credentialCode)) throw new Error("No existe la credencial institucional solicitada");
  for (const row of snapshot.credentials) {
    const student = students.get(row.estudiante_id), enrollment = enrollments.get(row.matricula_id);
    const relation = enrollment && relations.get(enrollment.programa_sede_id);
    const program = relation && programs.get(relation.programa_id), campus = relation && campuses.get(relation.sede_id);
    if (!student || !enrollment || enrollment.estudiante_id !== student.id || !relation || !program || !campus)
      throw new Error("La fuente contiene referencias académicas inconsistentes");
    grouped.get(student.id)!.credenciales.push({
      identificadorOrigen: row.id, contenido: toCredential(row, student, program, campus),
      estado: normalizeCredentialState(row.estado), sourceUpdatedAt: row.updated_at,
      programa: toProgram(program), sede: toCampus(campus), relacion: toProgramCampus(relation, program, campus),
    });
  }
  // Filtering selects the full student group, preserving the incorporation context.
  return [...grouped.values()].filter(v => !credentialCode || v.credenciales.some(c => c.contenido.codigoOrigen === credentialCode))
    .sort((a,b) => a.persona.identificadorOrigen.localeCompare(b.persona.identificadorOrigen))
    .map(v => academicObservationSchema.parse({ ...v, credenciales: v.credenciales.sort((a,b) => a.identificadorOrigen.localeCompare(b.identificadorOrigen)) }));
}
export function parseDetectionArgs(args: string[]): { credentialCode: string | null } {
  let credentialCode: string | null = null;
  for (const arg of args) {
    if (arg === "--") continue;
    if (arg.startsWith("--credential-code=") && credentialCode === null && arg.length > 18) credentialCode = arg.slice(18).trim();
    else throw new Error("Argumento inválido. Usa detect [--credential-code=CODIGO]; ya no hay sincronización canónica directa");
  }
  if (credentialCode === "") throw new Error("El código no puede estar vacío");
  return { credentialCode };
}
