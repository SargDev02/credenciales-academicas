import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/v1/credentials/route";

Object.assign(process.env, {
  CREDENLY_SUPABASE_URL: "https://credenly-fixture.supabase.co",
  CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key-never-public",
  RAES_API_BASE_URL: "https://raes-api-fixture.example",
  RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture",
  RAES_CREDENLY_CLIENT_SECRET: "raes_sk_fixture_secret_never_public",
});
test("Credenly entrega credenciales de dos instituciones mediante API y sin persistencia académica", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); requests.push(url.href);
    assert.ok(!init?.method || init.method === "GET", "Citizen read must never persist academic data");
    if (url.pathname === "/rest/v1/perfiles_admin") return Response.json([]);
    if (url.hostname === "credenly-fixture.supabase.co" && url.pathname === "/auth/v1/user") return Response.json({ id: "citizen", aud: "authenticated", role: "authenticated", created_at: "2025-01-01" });
    if (url.hostname === "credenly-fixture.supabase.co" && url.pathname === "/rest/v1/vinculaciones_raes") {
      assert.equal(url.searchParams.get("usuario_id"), "eq.citizen");
      return Response.json([{ usuario_id: "citizen", estado: "VERIFICADA", raes_persona_id: "master-person" }]);
    }
    assert.equal(url.hostname, "raes-api-fixture.example");
    assert.equal(url.pathname, "/api/v1/persons/master-person/credentials");
    return Response.json({ data: [{ id: "a", institucion: { id: "institution-a" } }, { id: "b", institucion: { id: "institution-b" } }] });
  };
  try {
    const result = await GET(new Request("http://localhost/api/v1/credentials", { headers: { authorization: "Bearer fixture-citizen-session" } }));
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.source, "RAES"); assert.equal(body.persistedByCredenly, false);
    assert.equal(body.data.length, 2);
    assert.equal(requests.filter(r => r.includes("raes-api-fixture")).length, 1);
    assert.equal(requests.some(r => r.includes("/rest/v1/credenciales")), false);
  } finally { globalThis.fetch = original; }
});
