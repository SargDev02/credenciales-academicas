import assert from "node:assert/strict";
import test from "node:test";

import { buildRaesAuthorization } from "./raes-client";

test("construye Authorization de servicio Credenly -> RAES", () => {
  const header = buildRaesAuthorization(
    "raes_cli_test",
    "raes_sk_test",
  );

  assert.equal(
    header,
    "Bearer raes_cli_test.raes_sk_test",
  );
});

import { getRaesCredentialsForPerson, RaesClientError } from "./raes-client";
Object.assign(process.env, { CREDENLY_SUPABASE_URL: "https://credenly-fixture.supabase.co", CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key-never-public", RAES_API_BASE_URL: "https://raes-api-fixture.example", RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture", RAES_CREDENLY_CLIENT_SECRET: "raes_sk_fixture_secret_never_public" });
const fixtureCredential = { id: "synthetic", codigoRaes: "SYNTHETIC", tipo: "DIPLOMA", categoria: "TITULO", estadoActual: "REVOCADA", versionActual: 2, fechaRegistroRaes: "2026-01-01", revocadaAt: "2026-01-02", motivoRevocacion: "Synthetic regression", anuladaAt: null, motivoAnulacion: null, programa: null, sede: null, institucion: null, version: null };
test("Credenly strips uncontracted upstream fields while preserving terminal states", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_, init) => { assert.equal(init?.redirect, "error"); return Response.json({ data: [{ ...fixtureCredential, payload_original: "PRIVATE_INTERNAL_MARKER" }] }); };
  try {
    const credentials = await getRaesCredentialsForPerson("synthetic");
    assert.equal(credentials[0]?.estadoActual, "REVOCADA");
    assert.equal(JSON.stringify(credentials).includes("PRIVATE_INTERNAL_MARKER"), false);
  } finally { globalThis.fetch = original; }
});
test("Credenly rejects malformed/oversized upstream responses and sanitizes errors", async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [
      Response.json({ data: [{ ...fixtureCredential, estadoActual: "UNKNOWN" }] }),
      Response.json({ data: null }),
      new Response("PRIVATE_INTERNAL_MARKER", { headers: { "content-length": String(3 * 1024 * 1024) } }),
      Response.json({ error: "PRIVATE_INTERNAL_MARKER", message: "PRIVATE_INTERNAL_MARKER" }, { status: 500 }),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(getRaesCredentialsForPerson("synthetic"), error => {
        assert.ok(error instanceof RaesClientError);
        assert.equal(`${error.message} ${error.code}`.includes("PRIVATE_INTERNAL_MARKER"), false);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});
