import test from "node:test";
import assert from "node:assert/strict";
import { listShares, ShareError } from "./sharing";
process.env.CREDENLY_SUPABASE_URL = "https://list-fixture.supabase.co";
process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-key-never-public";
process.env.RAES_API_BASE_URL = "https://raes.fixture.invalid";
process.env.RAES_CREDENLY_CLIENT_ID = "raes_cli_fixture";
process.env.RAES_CREDENLY_CLIENT_SECRET = "raes_sk_fixture_secret_never_public";
test("citizen share lists fail closed if PostgREST cannot return a complete bounded list", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async input => { const url = new URL(String(input)); assert.equal(url.searchParams.get("limit"), "1000"); assert.equal(url.searchParams.get("usuario_id"), "eq.synthetic"); return Response.json([], { headers: { "content-range": "*/1001" } }); };
    await assert.rejects(listShares("synthetic"), e => e instanceof ShareError && e.status === 503 && e.code === "LIST_LIMIT_EXCEEDED");
    globalThis.fetch = async () => Response.json([], { headers: { "content-range": "*/0" } });
    assert.deepEqual(await listShares("synthetic"), []);
  } finally { globalThis.fetch = original; }
});
