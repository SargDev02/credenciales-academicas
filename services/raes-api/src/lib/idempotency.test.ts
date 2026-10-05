import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalJson,
  getMutationRequestContext,
  hashMutationRequest,
} from "./idempotency";

test("canonical JSON produce el mismo valor sin importar orden de llaves", () => {
  const first = canonicalJson({
    codigoOrigen: "ABC-1",
    titulo: "Título",
    nested: {
      b: 2,
      a: 1,
    },
  });

  const second = canonicalJson({
    nested: {
      a: 1,
      b: 2,
    },
    titulo: "Título",
    codigoOrigen: "ABC-1",
  });

  assert.equal(first, second);
});

test("el hash de mutación es estable para payloads equivalentes", () => {
  const first = hashMutationRequest("CREDENTIAL_CREATE", {
    b: 2,
    a: 1,
  });

  const second = hashMutationRequest("CREDENTIAL_CREATE", {
    a: 1,
    b: 2,
  });

  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("el hash cambia cuando cambia el payload", () => {
  const first = hashMutationRequest("CREDENTIAL_CREATE", {
    codigoOrigen: "A",
  });

  const second = hashMutationRequest("CREDENTIAL_CREATE", {
    codigoOrigen: "B",
  });

  assert.notEqual(first, second);
});

test("extrae headers válidos de una mutación", () => {
  const request = new Request("http://localhost/test", {
    headers: {
      "X-Request-Id": "550e8400-e29b-41d4-a716-446655440000",
      "Idempotency-Key": "credencial-2026-0001",
    },
  });

  assert.deepEqual(getMutationRequestContext(request), {
    requestId: "550e8400-e29b-41d4-a716-446655440000",
    idempotencyKey: "credencial-2026-0001",
  });
});

test("rechaza mutaciones sin headers de idempotencia", () => {
  const request = new Request("http://localhost/test");

  assert.throws(
    () => getMutationRequestContext(request),
    /X-Request-Id/,
  );
});
