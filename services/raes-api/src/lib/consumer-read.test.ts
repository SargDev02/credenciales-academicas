import assert from "node:assert/strict";
import test from "node:test";
import { listCredentialsForPerson, ConsumerReadError } from "./consumer-read";
process.env.RAES_SUPABASE_URL = "https://consumer-read-fixture.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-key-never-public";
async function fixture(count: number, missingVersion: boolean, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "consumer-read-fixture.supabase.co");
    const table = url.pathname.split("/").at(-1);
    if (table === "personas_maestra") return Response.json([{ id: "person" }]);
    if (table === "credenciales") {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return Response.json(Array.from({ length: Math.min(1000, count - offset) }, (_, i) => ({ id: `c${offset + i}`, version_actual: 2 })), { headers: { "content-range": `${offset}-${Math.min(count - 1, offset + 999)}/${count}` } });
    }
    assert.equal(table, "credencial_versiones");
    assert.ok(url.searchParams.get("or")?.includes("numero_version.eq.2"));
    const ids = url.searchParams.get("credencial_id")!.slice(4, -1).split(",");
    assert.ok(ids.length <= 50);
    return Response.json(missingVersion ? [] : ids.map(id => ({ credencial_id: id, numero_version: 2, titulo: "Current" })));
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
test("más de 1000 credenciales se devuelven con sus versiones vigentes", async () => fixture(1001, false, async () => {
  const result = await listCredentialsForPerson("person");
  assert.equal(result.length, 1001); assert.ok(result.every(c => c.currentVersion.numero_version === 2));
}));
test("una versión vigente ausente produce error íntegro en vez de respuesta parcial", async () => fixture(1, true, async () => {
  await assert.rejects(listCredentialsForPerson("person"), e => e instanceof ConsumerReadError && e.code === "CREDENTIAL_CURRENT_VERSION_MISSING");
}));

test("credential reads reject excessive result counts instead of looping indefinitely", async () => fixture(10001, false, async () => {
  await assert.rejects(listCredentialsForPerson("person"), e => e instanceof ConsumerReadError && e.status === 503 && e.code === "CREDENTIAL_LIST_UNSTABLE_OR_TOO_LARGE");
}));
