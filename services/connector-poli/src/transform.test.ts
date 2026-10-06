import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCredentialState,
  toCredential,
  toPerson,
} from "./transform";

test("transforma un estudiante institucional al contrato RAES", () => {
  const person = toPerson({
    id: "3d0f0a3e-00a9-47b9-9ea7-c569a18ee646",
    tipo_documento: "CC",
    numero_documento: "1030000001",
    primer_nombre: "Ana",
    segundo_nombre: null,
    primer_apellido: "Restrepo",
    segundo_apellido: "Gómez",
  });

  assert.equal(
    person.identificadorOrigen,
    "3d0f0a3e-00a9-47b9-9ea7-c569a18ee646",
  );
  assert.equal(person.tipoDocumento, "CC");
});

test("transforma una credencial sin introducir UUID RAES", () => {
  const credential = toCredential(
    {
      id: "source-credential-1",
      estudiante_id: "student-1",
      matricula_id: "enrollment-1",
      codigo: "SIM-POLI-2025-0001",
      tipo: "DIPLOMA",
      titulo: "Diploma de Ingeniería Informática",
      descripcion: "Título académico de pregrado",
      fecha_emision: "2025-06-20",
      fecha_grado: "2025-06-20",
      numero_acta: "ACT-2025-061",
      numero_folio: "F-118",
      numero_libro: "L-22",
      hash_documento:
        "82b8735ed695dd0f9e4960d3de9951c2b0d43359a6cc32c2d030efafbcc27f41",
      estado: "VIGENTE",
      created_at: "2025-06-20T12:00:00Z",
      updated_at: "2025-06-20T12:00:00Z",
    },
    {
      id: "student-1",
      tipo_documento: "CC",
      numero_documento: "1030000001",
      primer_nombre: "Ana",
      segundo_nombre: null,
      primer_apellido: "Restrepo",
      segundo_apellido: null,
    },
    {
      id: "program-1",
      codigo_interno: "SIM-POLI-INF",
      codigo_snies: null,
      nombre: "Ingeniería Informática",
      nivel_formacion: "UNIVERSITARIA",
      modalidad: "PRESENCIAL",
      facultad: null,
      estado: "ACTIVO",
    },
    {
      id: "campus-1",
      codigo: "MED",
      nombre: "Campus Medellín",
      departamento: "Antioquia",
      municipio: "Medellín",
      direccion: null,
      estado: "ACTIVA",
    },
  );

  assert.equal(credential.categoria, "TITULO");
  assert.equal(
    credential.personaIdentificadorOrigen,
    "student-1",
  );
  assert.equal(credential.programaCodigoOrigen, "SIM-POLI-INF");
  assert.equal(credential.sedeCodigoOrigen, "MED");
});

test("normaliza estados terminales institucionales", () => {
  assert.equal(normalizeCredentialState("REVOCADO"), "REVOCADA");
  assert.equal(normalizeCredentialState("ANULADO"), "ANULADA");
  assert.equal(normalizeCredentialState("VIGENTE"), "VIGENTE");
});
