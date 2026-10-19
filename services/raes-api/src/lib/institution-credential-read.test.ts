import assert from "node:assert/strict";
import test from "node:test";
import { getInstitutionCredentialState } from "./institution-credential-read";
import { GET } from "../app/api/v1/credentials/source/[code]/route";
import { ApiError } from "./api-error";
import type { InstitutionalIdentity } from "./institution-auth";

process.env.RAES_SUPABASE_URL = "https://institution-read-test.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "test-server-key-only-fixture";
const identity: InstitutionalIdentity = { institutionId: "institution-a", integrationId: "integration-a", clientId: "fixture", integrationName: "fixture", scopes: ["credentials:read"] };
async function fixture(run: () => Promise<void>, missingVersion = false) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "institution-read-test.supabase.co");
    const table = url.pathname.split("/").at(-1);
    if (table === "credenciales") {
      const institution = url.searchParams.get("institucion_id");
      assert.ok(institution);
      return Response.json(institution === "eq.institution-a" ? [{ id: "credential-a", persona_id: "person-a", codigo_origen: "SAME-CODE", estado_actual: "VIGENTE", version_actual: 1, programas: { codigo_origen: "PROG" }, sedes: { codigo_origen: "CAMPUS" } }] : []);
    }
    if (table === "credencial_versiones") return Response.json(missingVersion ? { code: "PGRST116", message: "internal SQL" } : { tipo: "DIPLOMA", categoria: "TITULO", titulo: "Own credential", descripcion: null, fecha_emision: "2025-01-01", fecha_grado: null, numero_acta: null, numero_folio: null, numero_libro: null, documento_hash_sha256: null }, { status: missingVersion ? 406 : 200 });
    if (table === "operaciones_api") {
      assert.equal(url.searchParams.get("integracion_id"), "eq.integration-a");
      return Response.json([{ idempotency_key: "poli:create:source" }]);
    }
    if (table === "persona_fuentes") {
      assert.equal(url.searchParams.get("institucion_id"), "eq.institution-a");
      return Response.json([{ identificador_origen: "own-student" }]);
    }
    throw new Error("Unexpected database access");
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
test("la consulta institucional proyecta únicamente su credencial vigente", async () => fixture(async () => {
  const result = await getInstitutionCredentialState(identity, "SAME-CODE");
  assert.equal(result.payload.titulo, "Own credential");
  assert.equal(result.creationKey, "poli:create:source");
  assert.deepEqual(result.personSourceIds, ["own-student"]);
}));
test("otra institución recibe 404 aun usando el mismo código de origen", async () => fixture(async () => {
  await assert.rejects(getInstitutionCredentialState({ ...identity, institutionId: "institution-b" }, "SAME-CODE"), e => e instanceof ApiError && e.status === 404);
}));
test("versión ausente devuelve error seguro en vez de una proyección parcial", async () => fixture(async () => {
  await assert.rejects(getInstitutionCredentialState(identity, "SAME-CODE"), e => e instanceof ApiError && e.status === 500 && !e.message.includes("SQL"));
}, true));
test("ruta de consulta institucional exige autenticación", async () => {
  const response = await GET(new Request("http://localhost/api/v1/credentials/source/CODE"), { params: Promise.resolve({ code: "CODE" }) });
  assert.equal(response.status, 401);
});
