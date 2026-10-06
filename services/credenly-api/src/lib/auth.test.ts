import assert from "node:assert/strict";
import test from "node:test";

import {
  CitizenAuthError,
  extractBearerToken,
} from "./auth";

test("extrae un Bearer token válido", () => {
  assert.equal(
    extractBearerToken("Bearer access-token-123"),
    "access-token-123",
  );
});

test("acepta Bearer sin depender de mayúsculas", () => {
  assert.equal(
    extractBearerToken("bearer token-abc"),
    "token-abc",
  );
});

test("rechaza Authorization ausente", () => {
  assert.throws(
    () => extractBearerToken(null),
    (error: unknown) =>
      error instanceof CitizenAuthError &&
      error.code === "AUTHORIZATION_REQUIRED",
  );
});

test("rechaza formatos Authorization inválidos", () => {
  assert.throws(
    () => extractBearerToken("Basic abc"),
    (error: unknown) =>
      error instanceof CitizenAuthError &&
      error.code === "AUTHORIZATION_INVALID",
  );
});
