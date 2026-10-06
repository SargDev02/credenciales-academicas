import assert from "node:assert/strict";
import test from "node:test";

import {
  decideIdentityVerification,
  parseColombianIdentityDocument,
} from "./ocr-document-parser";

test("extrae identidad colombiana desde texto OCR etiquetado", () => {
  const parsed = parseColombianIdentityDocument(`
REPUBLICA DE COLOMBIA
CEDULA DE CIUDADANIA
NUMERO: 1030123456
APELLIDOS
GOMEZ RESTREPO
NOMBRES
VALENTINA MARIA
  `);

  assert.deepEqual(parsed, {
    tipoDocumento: "CC",
    numeroDocumento: "1030123456",
    nombres: "VALENTINA MARIA",
    apellidos: "GOMEZ RESTREPO",
  });
});

test("acepta identificadores sintéticos etiquetados para pruebas", () => {
  const parsed = parseColombianIdentityDocument(`
CEDULA DE CIUDADANIA
NUMERO: SIM-A-0001
APELLIDOS
GOMEZ RESTREPO
NOMBRES
VALENTINA MARIA
  `);

  assert.equal(parsed.numeroDocumento, "SIM-A-0001");
});

test("aprueba automáticamente solo con alta confianza e identidad completa", () => {
  const decision = decideIdentityVerification(
    {
      tipoDocumento: "CC",
      numeroDocumento: "1030123456",
      nombres: "VALENTINA MARIA",
      apellidos: "GOMEZ RESTREPO",
    },
    0.94,
  );

  assert.equal(decision.estado, "APROBADA");
  assert.equal(decision.motivoRevision, null);
  assert.equal(decision.motivoFallo, null);
});

test("envía a revisión una lectura completa con confianza moderada", () => {
  const decision = decideIdentityVerification(
    {
      tipoDocumento: "CC",
      numeroDocumento: "1030123456",
      nombres: "VALENTINA MARIA",
      apellidos: "GOMEZ RESTREPO",
    },
    0.82,
  );

  assert.equal(decision.estado, "REVISION");
  assert.match(
    decision.motivoRevision ?? "",
    /Confianza OCR insuficiente/,
  );
});

test("rechaza cuando no logra identificar tipo y número de documento", () => {
  const decision = decideIdentityVerification(
    {
      tipoDocumento: null,
      numeroDocumento: null,
      nombres: null,
      apellidos: null,
    },
    0.98,
  );

  assert.equal(decision.estado, "RECHAZADA");
  assert.ok(decision.motivoFallo);
});
