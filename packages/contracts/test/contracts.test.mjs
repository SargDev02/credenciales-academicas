import assert from "node:assert/strict";
import test from "node:test";

import {
  anulacionCredencialSchema,
  correccionCredencialSchema,
  credencialNuevaSchema,
  personaSchema,
  programaSchema,
  revocacionCredencialSchema,
  sedeSchema,
} from "../dist/index.js";

const personaValida = {
  identificadorOrigen: "estudiante-123",
  tipoDocumento: "CC",
  numeroDocumento: "1030000001",
  primerNombre: "Ana",
  segundoNombre: null,
  primerApellido: "Restrepo",
  segundoApellido: "Gomez",
};

const credencialValida = {
  codigoOrigen: "SIM-POLI-2026-0001",
  personaIdentificadorOrigen: personaValida.identificadorOrigen,
  programaCodigoOrigen: "SIM-POLI-INF",
  sedeCodigoOrigen: "MED",
  tipo: "DIPLOMA",
  categoria: "TITULO",
  titulo: "Ingeniería Informática",
  descripcion: null,
  fechaEmision: "2026-09-30",
  fechaGrado: "2026-09-25",
  numeroActa: "145",
  numeroFolio: "22",
  numeroLibro: "8",
  documentoHashSha256: "a".repeat(64),
};

test("acepta una persona institucional válida", () => {
  const result = personaSchema.safeParse(personaValida);
  assert.equal(result.success, true);
});

test("la identidad documental exige un tipo de documento válido", () => {
  const result = personaSchema.safeParse({
    ...personaValida,
    tipoDocumento: "cc",
  });
  assert.equal(result.success, false);
});

test("acepta sede y programa sin código SNIES obligatorio", () => {
  assert.equal(
    sedeSchema.safeParse({
      codigoOrigen: "MED",
      nombre: "Campus Medellín",
      municipio: "Medellín",
      estado: "ACTIVA",
    }).success,
    true,
  );

  assert.equal(
    programaSchema.safeParse({
      codigoOrigen: "SIM-POLI-INF",
      codigoSnies: null,
      nombre: "Ingeniería Informática",
      nivelFormacion: "UNIVERSITARIA",
      modalidad: "PRESENCIAL",
      estado: "ACTIVO",
    }).success,
    true,
  );
});

test("acepta una credencial nueva válida", () => {
  const result = credencialNuevaSchema.safeParse(credencialValida);
  assert.equal(result.success, true);
});

test("rechaza hashes de documento que no sean SHA-256", () => {
  const result = credencialNuevaSchema.safeParse({
    ...credencialValida,
    documentoHashSha256: "1234",
  });
  assert.equal(result.success, false);
});

test("la corrección exige una fotografía completa de los datos actualizados", () => {
  const result = correccionCredencialSchema.safeParse({
    codigoOrigen: credencialValida.codigoOrigen,
    motivo: "Corrección de número de acta",
    ocurridoAt: "2026-10-05T10:00:00-05:00",
    datosActualizados: {
      ...credencialValida,
      numeroActa: "146",
    },
  });

  assert.equal(result.success, true);
});

test("acepta comandos explícitos de revocación y anulación", () => {
  const base = {
    codigoOrigen: credencialValida.codigoOrigen,
    motivo: "Decisión reportada por la institución",
    ocurridoAt: "2026-10-05T10:00:00-05:00",
  };

  assert.equal(revocacionCredencialSchema.safeParse(base).success, true);
  assert.equal(anulacionCredencialSchema.safeParse(base).success, true);
});
