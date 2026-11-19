import assert from "node:assert/strict";
import test from "node:test";
import { authenticateCitizen, CitizenAuthError } from "./auth";
import { GET as me } from "../app/api/v1/auth/me/route";
import { GET as credentials } from "../app/api/v1/credentials/route";
import { GET as shares, POST as createShare } from "../app/api/v1/shares/route";
import { GET as profile, PUT as updateProfile } from "../app/api/v1/profile/route";
import { GET as verifications, POST as verify } from "../app/api/v1/identity-verifications/route";
import { GET as link, POST as resolveLink } from "../app/api/v1/raes/link/route";

Object.assign(process.env, {
  CREDENLY_SUPABASE_URL: "https://citizen-state-fixture.supabase.co",
  CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-service-only-never-public",
  RAES_API_BASE_URL: "https://raes-fixture.example",
  RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture",
  RAES_CREDENLY_CLIENT_SECRET: "fixture-private-raes-secret",
});
const id = "00000000-0000-4000-8000-000000000001";
const request = () => new Request("http://localhost/api/v1/credentials", {
  headers: { authorization: "Bearer local-fixture-session" },
});
async function fixture(state: string | null, run: () => Promise<void>, failed = false) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(init?.method ?? "GET", "GET", "Guard must never write data");
    assert.equal(url.hostname, "citizen-state-fixture.supabase.co", "No RAES call before access validation");
    if (url.pathname === "/auth/v1/user") return Response.json({ id, aud: "authenticated", role: "authenticated", created_at: "2026-10-19", user_metadata: { estado: "ACTIVO", rol: "ADMIN_CREDENLY" } });
    assert.equal(url.searchParams.get("id"), `eq.${id}`);
    if (url.pathname === "/rest/v1/perfiles_admin") return Response.json([]);
    assert.equal(url.pathname, "/rest/v1/perfiles", "No citizen business read before access validation");
    assert.equal(url.searchParams.get("select"), "estado");
    return failed
      ? Response.json({ message: "private SQL marker" }, { status: 500 })
      : Response.json(state === null ? [] : [{ estado: state }]);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
for (const state of ["SUSPENDIDO", "CERRADO"]) {
  test(`${state} denies citizen reads and mutations before RAES or business access despite forged metadata`, async () => {
    await fixture(state, async () => {
      for (const handler of [me, credentials, shares, createShare, profile, updateProfile, verifications, verify, link, resolveLink]) {
        const response = await handler(request());
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), {
          error: "CITIZEN_ACCOUNT_RESTRICTED",
          message: "El estado de tu cuenta no permite el acceso ciudadano",
        });
      }
    });
  });
}
for (const state of ["ACTIVO", "PENDIENTE_VERIFICACION", null]) {
  test(`${state ?? "missing profile"} retains citizen authentication and onboarding`, async () => {
    await fixture(state, async () => {
      assert.equal((await authenticateCitizen(request())).id, id);
      assert.equal((await me(request())).status, 200);
    });
  });
}
test("profile lookup failure returns sanitized 503 before any business access", async () => {
  await fixture("ACTIVO", async () => {
    const response = await credentials(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "CITIZEN_ACCESS_UNAVAILABLE", message: "No fue posible validar el acceso ciudadano" });
  }, true);
});
test("unknown profile state fails closed instead of granting citizen access", async () => {
  await fixture("UNKNOWN", async () => {
    await assert.rejects(authenticateCitizen(request()), e => e instanceof CitizenAuthError && e.status === 503 && e.code === "CITIZEN_ACCESS_UNAVAILABLE");
  });
});
