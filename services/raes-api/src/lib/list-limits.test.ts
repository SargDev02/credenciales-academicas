import test from "node:test";
import assert from "node:assert/strict";
import { listInstitutions, listApiClients, ProvisioningError } from "./admin-provisioning";
process.env.RAES_SUPABASE_URL = "https://list-fixture.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-key-never-public";
test("administrative lists never claim a truncated page is a complete list", async () => {
  const original = globalThis.fetch;
  try {
    for (const read of [listInstitutions, listApiClients]) {
      globalThis.fetch = async input => { assert.equal(new URL(String(input)).searchParams.get("limit"), "1000"); return Response.json([{ id: "synthetic" }], { headers: { "content-range": "0-0/1001" } }); };
      await assert.rejects(read(), e => e instanceof ProvisioningError && e.status === 503 && e.code === "LIST_LIMIT_EXCEEDED");
      globalThis.fetch = async () => Response.json([], { headers: { "content-range": "*/0" } });
      assert.deepEqual(await read(), []);
    }
  } finally { globalThis.fetch = original; }
});
