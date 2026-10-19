import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { parseJsonBody, readBoundedBody, requestValidationErrorResponse, RequestValidationError } from "./request-validation";
const schema = z.object({ value: z.string().max(5) });
for (const body of ["{", "", JSON.stringify({ value: "PRIVATE-DATA" })]) test(`JSON ciudadano inválido devuelve 400 seguro (${body.length})`, async () => {
  try { await parseJsonBody(new Request("http://localhost", { method: "POST", body }), schema); assert.fail("Expected invalid body"); }
  catch (error) { const response = requestValidationErrorResponse(error)!; assert.equal(response.status, 400); assert.equal(JSON.stringify(await response.json()).includes("PRIVATE-DATA"), false); }
});
test("JSON ciudadano limita bytes reales aunque falte Content-Length", async () => {
  await assert.rejects(parseJsonBody(new Request("http://localhost", { method: "POST", body: "x".repeat(65537) }), schema), e => e instanceof RequestValidationError && e.status === 413);
});
test("lector multipart rechaza tamaño declarado excesivo antes de procesar archivo", async () => {
  await assert.rejects(readBoundedBody(new Request("http://localhost", { method: "POST", headers: { "content-length": "99999999" }, body: "" }), 8 * 1024 * 1024 + 65536), e => e instanceof RequestValidationError && e.status === 413);
});
test("lector acotado aplica límite también a bytes del stream", async () => {
  await assert.rejects(readBoundedBody(new Request("http://localhost", { method: "POST", body: "x".repeat(101) }), 100), e => e instanceof RequestValidationError && e.status === 413);
});

test("la ruta de perfil autenticada convierte JSON malformado en 400", async () => {
  Object.assign(process.env, { CREDENLY_SUPABASE_URL: "https://profile-fixture.supabase.co", CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key-never-public", RAES_API_BASE_URL: "https://raes-api.example", RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture", RAES_CREDENLY_CLIENT_SECRET: "raes_sk_fixture_secret" });
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    if (new URL(String(input)).pathname === "/rest/v1/perfiles_admin") return Response.json([]);
    assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
    return Response.json({ id: "citizen", aud: "authenticated", role: "authenticated", created_at: "2025-01-01" });
  };
  try {
    const { PUT } = await import("../app/api/v1/profile/route");
    const response = await PUT(new Request("http://localhost", { method: "PUT", headers: { authorization: "Bearer fixture-session" }, body: "{" }));
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "INVALID_JSON");
  } finally { globalThis.fetch = original; }
});

test("multipart válido conserva archivo y tipo al aplicar límite de bytes", async () => {
  const form = new FormData(); form.set("documento", new File(["fixture-image-bytes"], "document.png", { type: "image/png" }));
  const request = new Request("http://localhost", { method: "POST", body: form });
  const bytes = await readBoundedBody(request, 1024);
  const parsed = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  const file = parsed.get("documento") as File;
  assert.equal(file.type, "image/png"); assert.equal(await file.text(), "fixture-image-bytes");
});
