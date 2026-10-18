import assert from "node:assert/strict";
import test from "node:test";
import { authenticateAdmin, AdminAuthError, adminAuthErrorResponse } from "./admin-auth";
import { authenticateInstitution, InstitutionalAuthError } from "./institution-auth";
import { formatApiBearer, hashClientSecret, parseApiBearer } from "./api-credentials";
process.env.RAES_SUPABASE_URL = "https://authorization-fixture.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-key-never-public";
const secret = "raes_sk_fixture_secret_no_logging";
const request = () => new Request("http://localhost", { headers: { authorization: formatApiBearer("raes_cli_fixture", secret) } });
async function fixture(options: { userInvalid?: boolean; adminState?: string; role?: string; integrationState?: string; institutionState?: string; expired?: boolean; revoked?: boolean; scopes?: string[] }, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.hostname, "authorization-fixture.supabase.co");
    if (url.pathname === "/auth/v1/user") return options.userInvalid
      ? Response.json({ msg: "expired", code: "bad_jwt" }, { status: 401 })
      : Response.json({ id: "user", aud: "authenticated", role: "authenticated", created_at: "2025-01-01", user_metadata: { role: "SUPERADMIN" } });
    if (init?.method === "PATCH") return new Response(null, { status: 204 });
    const table = url.pathname.split("/").at(-1);
    if (table === "perfiles_admin") return Response.json([{ id: "user", rol: options.role ?? "SUPERADMIN", estado: options.adminState ?? "ACTIVO" }]);
    if (table === "integraciones_institucionales") return Response.json([{ id: "integration", institucion_id: "institution", client_id: "raes_cli_fixture", nombre: "fixture", estado: options.integrationState ?? "ACTIVA" }]);
    if (table === "instituciones") return Response.json([{ estado: options.institutionState ?? "ACTIVA" }]);
    if (table === "integracion_secretos") return Response.json(options.revoked ? [] : [{ id: "secret", hash_algorithm: "SHA256", secret_hash: hashClientSecret(secret), revoked_at: null, expires_at: options.expired ? "2000-01-01T00:00:00Z" : null }]);
    if (table === "integracion_scopes") return Response.json((options.scopes ?? ["credentials:create"]).map(codigo => ({ scopes: { codigo } })));
    throw new Error("Unexpected auth request");
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
test("sesión admin inválida/expirada se rechaza por Auth", async () => fixture({ userInvalid: true }, async () => {
  await assert.rejects(authenticateAdmin(request()), e => e instanceof AdminAuthError && e.status === 401);
}));
test("admin inactivo no puede aprovisionar", async () => fixture({ adminState: "INACTIVO" }, async () => {
  await assert.rejects(authenticateAdmin(request()), e => e instanceof AdminAuthError && e.status === 403);
}));
test("user_metadata no permite a AUDITOR elevar su rol", async () => fixture({ role: "AUDITOR" }, async () => {
  await assert.rejects(authenticateAdmin(request()), e => e instanceof AdminAuthError && e.code === "INSUFFICIENT_ROLE");
}));
test("SUPERADMIN activo conserva acceso", async () => fixture({}, async () => {
  assert.equal((await authenticateAdmin(request())).profile.rol, "SUPERADMIN");
}));
for (const [label, options] of Object.entries({ inactive: { integrationState: "INACTIVA" }, suspendedInstitution: { institutionState: "SUSPENDIDA" }, expiredSecret: { expired: true }, revokedSecret: { revoked: true } })) test(`integración ${label} se rechaza`, async () => fixture(options, async () => {
  await assert.rejects(authenticateInstitution(request()), e => e instanceof InstitutionalAuthError && e.status === 401);
}));
test("integración sin scope devuelve 403", async () => fixture({ scopes: [] }, async () => {
  await assert.rejects(authenticateInstitution(request(), ["credentials:create"]), e => e instanceof InstitutionalAuthError && e.status === 403);
}));
test("integración válida conserva tenant y permisos", async () => fixture({}, async () => {
  assert.equal((await authenticateInstitution(request(), ["credentials:create"])).institutionId, "institution");
}));
test("Bearer acepta esquema sin distinguir mayúsculas y rechaza tokens múltiples", () => {
  assert.ok(parseApiBearer(`bearer raes_cli_fixture.${secret}`));
  for (const header of [`Bearer raes_cli_fixture.${secret} other`, `Bearer raes_cli_fixture.${secret},other`, `Bearer raes_cli_fixture.${secret}.other`]) assert.equal(parseApiBearer(header), null);
});
test("excepción interna de auth no se refleja en logs ni respuesta", async () => {
  const original = console.error; const logs: string[] = []; console.error = (...args) => { logs.push(JSON.stringify(args)); };
  try {
    const response = adminAuthErrorResponse(new Error(secret));
    assert.equal(response.status, 500); assert.equal(JSON.stringify(await response.json()).includes(secret), false);
    assert.equal(logs.join("").includes(secret), false);
  } finally { console.error = original; }
});
