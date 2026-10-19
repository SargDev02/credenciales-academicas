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

test("sesión ciudadana expirada/incorrecta es rechazada por Supabase Auth", async () => {
  const { authenticateCitizen, CitizenAuthError } = await import("./auth");
  Object.assign(process.env, { CREDENLY_SUPABASE_URL: "https://citizen-auth-fixture.supabase.co", CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key-never-public", RAES_API_BASE_URL: "https://raes-api.example", RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture", RAES_CREDENLY_CLIENT_SECRET: "raes_sk_fixture_secret" });
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ msg: "Invalid JWT", code: "bad_jwt" }, { status: 401 });
  try {
    await assert.rejects(authenticateCitizen(new Request("http://localhost", { headers: { authorization: "Bearer invalid-session" } })), e => e instanceof CitizenAuthError && e.status === 401);
  } finally { globalThis.fetch = original; }
});
