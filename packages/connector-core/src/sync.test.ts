import assert from "node:assert/strict";
import test from "node:test";
import { synchronize } from "./sync";
import { RaesClient, type CredentialSyncState } from "./raes-client";
import type { InstitutionalSnapshot } from "./source";
import type { CredencialNueva, CorreccionCredencial, RevocacionCredencial, AnulacionCredencial } from "@raes/contracts";

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
class FakeRaes extends RaesClient {
  rows = new Map<string, CredentialSyncState>();
  history: string[] = [];
  events: string[] = [];
  writes = 0;
  constructor(namespace = "udea") { super({ baseUrl: "http://localhost", clientId: "fixture", clientSecret: "fixture", namespace }); }
  async syncInstitution() { this.writes++; }
  async syncCampus() { this.writes++; }
  async syncProgram() { this.writes++; }
  async syncProgramCampus() { this.writes++; }
  async syncPerson() { this.writes++; }
  async getCredentialState(code: string) { return this.rows.get(code) ?? null; }
  async createCredential(payload: CredencialNueva, headers: { idempotencyKey: string }) {
    const { personaIdentificadorOrigen, ...academic } = payload;
    this.rows.set(payload.codigoOrigen, { state: "VIGENTE", version: 1, creationKey: headers.idempotencyKey, personSourceIds: [personaIdentificadorOrigen], payload: academic });
    this.history.push(payload.titulo); this.events.push("REGISTRADA");
  }
  async correctCredential(command: CorreccionCredencial) {
    const current = this.rows.get(command.codigoOrigen)!;
    current.payload = { codigoOrigen: command.codigoOrigen, ...command.datosActualizados };
    current.version++; this.history.push(command.datosActualizados.titulo); this.events.push("CORREGIDA");
  }
  async revokeCredential(command: RevocacionCredencial) { this.terminal(command.codigoOrigen, "REVOCADA"); }
  async annulCredential(command: AnulacionCredencial) { this.terminal(command.codigoOrigen, "ANULADA"); }
  terminal(code: string, state: "REVOCADA" | "ANULADA") {
    const current = this.rows.get(code)!; current.state = state; current.version++;
    this.history.push(current.payload.titulo); this.events.push(state);
  }
}
const options = { mode: "all" as const, credentialCode: null };

test("registro y reejecución no duplican credenciales/versiones/eventos", async () => {
  const raes = new FakeRaes(); const s = snapshot();
  await synchronize(s, raes, options); await synchronize(s, raes, options);
  assert.equal(raes.rows.size, 1); assert.deepEqual(raes.events, ["REGISTRADA"]);
});
test("corrección y vuelta al contenido inicial preservan todas las versiones", async () => {
  const raes = new FakeRaes(); const s = snapshot();
  await synchronize(s, raes, options);
  s.credentials[0]!.titulo = "Título corregido"; s.credentials[0]!.updated_at = "2025-02-01T00:00:00Z";
  await synchronize(s, raes, options); await synchronize(s, raes, options);
  s.credentials[0]!.titulo = "Título inicial"; s.credentials[0]!.updated_at = "2025-03-01T00:00:00Z";
  await synchronize(s, raes, options);
  assert.deepEqual(raes.history, ["Título inicial", "Título corregido", "Título inicial"]);
  assert.equal(raes.rows.get("TEST-001")!.version, 3);
});
for (const state of ["REVOCADO", "ANULADO"]) test(`estado ${state} conserva versión inicial y no repite transición`, async () => {
  const raes = new FakeRaes(); const s = snapshot(); s.credentials[0]!.estado = state;
  await synchronize(s, raes, options); await synchronize(s, raes, options);
  assert.equal(raes.history.length, 2); assert.equal(raes.rows.get("TEST-001")!.version, 2);
});
test("cambios de estado terminal se reportan sin destruir historial", async () => {
  const raes = new FakeRaes(); const s = snapshot(); s.credentials[0]!.estado = "REVOCADO";
  await synchronize(s, raes, options); s.credentials[0]!.estado = "VIGENTE";
  const summary = await synchronize(s, raes, options);
  assert.deepEqual(summary.terminalStateConflicts, ["TEST-001"]);
  assert.equal(raes.events.length, 2);
});
test("no adopta credenciales de otras operaciones", async () => {
  const raes = new FakeRaes(); const s = snapshot(); await synchronize(s, raes, options);
  raes.rows.get("TEST-001")!.creationKey = "manual-creation";
  s.credentials[0]!.titulo = "Cambio externo";
  const summary = await synchronize(s, raes, options);
  assert.deepEqual(summary.existingCredentialsNotAdopted, ["TEST-001"]);
  assert.equal(raes.history.length, 1);
});
test("matrícula de otra persona falla antes de escribir en RAES", async () => {
  const raes = new FakeRaes(); const s = snapshot(); s.enrollments[0]!.estudiante_id = "other";
  await assert.rejects(synchronize(s, raes, options)); assert.equal(raes.writes, 0);
});
test("identidad de credencial existente no se reasigna", async () => {
  const raes = new FakeRaes(); const s = snapshot(); await synchronize(s, raes, options);
  raes.rows.get("TEST-001")!.personSourceIds = ["other-source"];
  await assert.rejects(synchronize(s, raes, options), /identidad/);
});
test("namespaces de ambas instituciones permanecen separados", async () => {
  const a = new FakeRaes("poli"); const b = new FakeRaes("udea");
  await synchronize(snapshot(), a, options); await synchronize(snapshot(), b, options);
  assert.notEqual(a.rows.get("TEST-001")!.creationKey, b.rows.get("TEST-001")!.creationKey);
});
test("orden de propiedades JSON no genera correcciones", async () => {
  const raes = new FakeRaes(); const s = snapshot(); await synchronize(s, raes, options);
  const row = raes.rows.get("TEST-001")!;
  row.payload = Object.fromEntries(Object.entries(row.payload).reverse()) as typeof row.payload;
  await synchronize(s, raes, options); assert.equal(raes.history.length, 1);
});
