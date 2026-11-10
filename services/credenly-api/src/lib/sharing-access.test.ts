import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublicShare, ShareError } from "./sharing";
import { generateShareToken } from "./share-token";
Object.assign(process.env, { CREDENLY_SUPABASE_URL: "https://sharing-fixture.supabase.co", CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key-never-public", RAES_API_BASE_URL: "https://raes-api-fixture.example", RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture", RAES_CREDENLY_CLIENT_SECRET: "raes_sk_fixture_secret" });
async function fixture(auditFails: boolean, run: (writes: string[]) => Promise<void>, state: "active" | "expired" | "revoked" = "active") {
  const original = globalThis.fetch; const writes: string[] = [];
  const originalLog = console.error; console.error = () => {};
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "raes-api-fixture.example") return Response.json({ data: [{ id: "credential", codigoRaes: "TEST", tipo: "DIPLOMA", categoria: "TITULO", estadoActual: "VIGENTE", versionActual: 1, fechaRegistroRaes: "2026-01-01", revocadaAt: null, motivoRevocacion: null, anuladaAt: null, motivoAnulacion: null, programa: null, sede: null, institucion: null, version: null }] });
    assert.equal(url.hostname, "sharing-fixture.supabase.co");
    if (url.pathname.endsWith("/comparticiones")) return Response.json([{ id: "share", usuario_id: "citizen", raes_credencial_id: "credential", campos_visibles: [], expires_at: state === "expired" ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z", revoked_at: state === "revoked" ? "2025-01-01T00:00:00Z" : null }]);
    if (url.pathname.endsWith("/vinculaciones_raes")) return Response.json([{ usuario_id: "citizen", raes_persona_id: "master", estado: "VERIFICADA" }]);
    assert.ok(url.pathname.endsWith("/accesos_compartidos"));
    assert.equal(init?.method, "POST"); writes.push(String(init?.body));
    return auditFails ? Response.json({ code: "XX000", message: "private internal detail" }, { status: 400 }) : new Response(null, { status: 201 });
  };
  try { await run(writes); } finally { globalThis.fetch = original; console.error = originalLog; }
}
test("verificación pública no entrega credenciales si no puede persistir auditoría", async () => fixture(true, async writes => {
  await assert.rejects(verifyPublicShare(generateShareToken(), new Request("http://localhost")), e => e instanceof ShareError && e.status === 503 && e.code === "ACCESS_AUDIT_UNAVAILABLE");
  assert.equal(writes.length, 1);
}));
test("acceso público conserva procedencia RAES y solo persiste IP pseudonimizada", async () => fixture(false, async writes => {
  const result = await verifyPublicShare(generateShareToken(), new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.1" } }));
  assert.equal(result.source, "RAES"); assert.equal(result.persistedByCredenly, false);
  assert.equal(writes.length, 1); assert.equal(writes[0]!.includes("203.0.113.1"), false);
  assert.equal(JSON.parse(writes[0]!).resultado, "OK");
}));

for (const state of ["expired", "revoked"] as const) test(`enlace ${state} devuelve 410 con acceso auditado`, async () => fixture(false, async writes => {
  await assert.rejects(verifyPublicShare(generateShareToken(), new Request("http://localhost")), e => e instanceof ShareError && e.status === 410 && e.code === (state === "expired" ? "SHARE_EXPIRED" : "SHARE_REVOKED"));
  assert.equal(JSON.parse(writes[0]!).resultado, state === "expired" ? "ENLACE_EXPIRADO" : "ENLACE_REVOCADO");
}, state));
