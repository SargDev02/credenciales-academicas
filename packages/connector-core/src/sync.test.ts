import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { detect } from "./sync";
import { buildAcademicObservations, parseDetectionArgs } from "./academic-review";
import { RaesClient } from "./raes-client";
import type { InstitutionalSnapshot } from "./source";
import type { AcademicObservation } from "@raes/contracts";

function snapshot(): InstitutionalSnapshot {
  return {
    institution: { nit: "890980040-8", codigo_snies: null, nombre: "Universidad de Antioquia", tipo_institucion: "UNIVERSIDAD", estado: "ACTIVA" },
    campuses: [{ id: "campus", codigo: "MED", nombre: "Medellín", departamento: null, municipio: null, direccion: null, estado: "ACTIVA" }],
    programs: [{ id: "program", codigo_interno: "INF", codigo_snies: null, nombre: "Informática", nivel_formacion: null, modalidad: null, facultad: null, estado: "ACTIVO" }],
    programCampuses: [{ id: "relation", programa_id: "program", sede_id: "campus", jornada: null, modalidad: null, estado: "ACTIVO" }],
    students: [{ id: "student", tipo_documento: "CC", numero_documento: "TEST-001", primer_nombre: "Persona", segundo_nombre: null, primer_apellido: "Prueba", segundo_apellido: null }],
    enrollments: [{ id: "enrollment", estudiante_id: "student", programa_sede_id: "relation" }],
    credentials: [{ id: "source-credential", estudiante_id: "student", matricula_id: "enrollment", codigo: "TEST-001", tipo: "DIPLOMA", titulo: "Título inicial", descripcion: null, fecha_emision: "2025-01-01", fecha_grado: null, numero_acta: null, numero_folio: null, numero_libro: null, hash_documento: null, estado: "VIGENTE", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" }],
  };
}

class RecordingRaes extends RaesClient {
  submitted: AcademicObservation[] = [];
  constructor() { super({ baseUrl: "http://localhost:9", clientId: "fixture", clientSecret: "fixture", namespace: "test" }); }
  override async submitReview(_id: string, observation: AcademicObservation) {
    this.submitted.push(observation);
    return { observaciones: [{ id: randomUUID(), estado: "PENDIENTE" as const, nueva: true }] };
  }
  override async syncPerson(): Promise<never> { throw new Error("Canonical person write forbidden"); }
  override async createCredential(): Promise<never> { throw new Error("Canonical credential write forbidden"); }
  override async correctCredential(): Promise<never> { throw new Error("Canonical correction forbidden"); }
  override async revokeCredential(): Promise<never> { throw new Error("Canonical revocation forbidden"); }
  override async annulCredential(): Promise<never> { throw new Error("Canonical annulment forbidden"); }
}
test("detection groups a student and credentials without canonical API writes", async()=>{
 const raes=new RecordingRaes();const result=await detect(snapshot(),raes,randomUUID());
 assert.equal(result.canonicalWrites,0);assert.equal(result.proposalsCreated,1);assert.equal(raes.submitted.length,1);assert.equal(raes.submitted[0]!.credenciales.length,1);
});
test("descriptive edits are submitted without needing connector creation ownership", async()=>{
 const s=snapshot(),raes=new RecordingRaes();await detect(s,raes,randomUUID());s.credentials[0]!.titulo="Título posterior";await detect(s,raes,randomUUID());
 assert.equal(raes.submitted[1]!.credenciales[0]!.contenido.titulo,"Título posterior");
});
for(const [source,expected] of [["VIGENTE","VIGENTE"],["REVOCADO","REVOCADA"],["ANULADO","ANULADA"]])test(`reported ${source} is proposed, never applied`, async()=>{
 const s=snapshot(),raes=new RecordingRaes();s.credentials[0]!.estado=source!;await detect(s,raes,randomUUID());assert.equal(raes.submitted[0]!.credenciales[0]!.estado,expected);
});
test("terminal-to-active reports are still proposals rather than automatic reactivation",async()=>{
 const s=snapshot(),raes=new RecordingRaes();s.credentials[0]!.estado="REVOCADO";await detect(s,raes,randomUUID());s.credentials[0]!.estado="VIGENTE";await detect(s,raes,randomUUID());assert.equal(raes.submitted[1]!.credenciales[0]!.estado,"VIGENTE");
});
test("all source references are validated before any submission",async()=>{
 const s=snapshot(),raes=new RecordingRaes();s.credentials.push({...s.credentials[0]!,id:"broken",matricula_id:"missing"});await assert.rejects(detect(s,raes,randomUUID()));assert.equal(raes.submitted.length,0);
});
test("a credential cannot use another student's enrollment",()=>{
 const s=snapshot();s.enrollments[0]!.estudiante_id="another";assert.throws(()=>buildAcademicObservations(s));
});
test("filtering keeps the full incorporation group and rejects unknown codes",()=>{
 const s=snapshot();s.credentials.push({...s.credentials[0]!,id:"second",codigo:"SECOND"});assert.equal(buildAcademicObservations(s,"SECOND")[0]!.credenciales.length,2);assert.throws(()=>buildAcademicObservations(s,"missing"));
});
test("missing optional fields normalize to null and timestamps stay outside academic content",()=>{
 const o=buildAcademicObservations(snapshot())[0]!;assert.equal(o.persona.segundoNombre,null);assert.equal(o.sourceUpdatedAt,null);assert.equal(o.credenciales[0]!.contenido.numeroActa,null);
});
test("legacy direct sync modes are rejected; detect code selection is explicit",()=>{
 assert.deepEqual(parseDetectionArgs(["--","--credential-code=TEST-001"]),{credentialCode:"TEST-001"});for(const arg of ["--only=all","--only=base","--only=credentials","--credential-code="])assert.throws(()=>parseDetectionArgs([arg]));
});
