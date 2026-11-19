import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/v1/persons/resolve/route";
import { GET } from "../app/api/v1/persons/[personId]/credentials/route";
import { GET as whoami } from "../app/api/v1/auth/client-whoami/route";
import { formatApiBearer, hashClientSecret } from "./api-credentials";

const personId = "10000000-0000-4000-8000-000000000001";
const clientDbId = "20000000-0000-4000-8000-000000000002";
const clientId = "raes_cli_test_client";
const secret = "raes_sk_fixture_secret_do_not_log";
const authorization = formatApiBearer(clientId, secret);
const documentNumber = "SYNTHETIC-12345";
process.env.RAES_SUPABASE_URL = "https://audit-test.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "test-service-key-never-log";

type Options = {
  state?: string;
  scopes?: string[];
  expiresAt?: string;
  revoked?: boolean;
  secretHash?: string;
  missingPerson?: boolean;
  readError?: boolean;
  readThrow?: boolean;
  emptyCredentials?: boolean;
  auditError?: boolean;
  auditThrow?: boolean;
};

// Run real route -> auth -> read -> audit against a simulated PostgREST transport.
// Never loads .env.local or contacts a remote project.
async function fixture(options: Options, run: (records: Record<string, unknown>[], calls: string[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs: string[] = [];
  console.error = (...args: unknown[]) => { logs.push(JSON.stringify(args)); };
  const records: Record<string, unknown>[] = [];
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "audit-test.supabase.co");
    const table = url.pathname.split("/").at(-1)!;
    calls.push(table);
    const method = init?.method ?? "GET";
    if (method === "PATCH") return new Response(null, { status: 204 });
    if (table === "auditoria") {
      if (options.auditThrow) throw new Error(`internal ${secret}`);
      if (options.auditError) return Response.json({ code: "23514", message: secret, details: documentNumber }, { status: 400 });
      records.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    if (table === "clientes_api") return Response.json([
      { id: clientDbId, nombre: "Fixture", tipo_cliente: "CREDENLY", client_id: clientId, estado: options.state ?? "ACTIVO" },
    ]);
    if (table === "cliente_api_secretos") {
      assert.equal(url.searchParams.get("revoked_at"), "is.null");
      return Response.json(options.revoked ? [] : [{
        id: "secret-id", secret_hash: options.secretHash ?? hashClientSecret(secret), hash_algorithm: "SHA256",
        expires_at: options.expiresAt ?? null, revoked_at: null,
      }]);
    }
    if (table === "cliente_api_scopes") return Response.json(
      (options.scopes ?? ["persons:resolve", "credentials:read"]).map(codigo => ({ scopes: { codigo } })),
    );
    if (options.readThrow) throw new Error(`database error ${secret}`);
    if (options.readError) return Response.json({ code: "XX000", message: secret }, { status: 500 });
    if (table === "personas_maestra") return Response.json(options.missingPerson ? [] : [{
      id: personId, tipo_documento: "CC", numero_documento: documentNumber, primer_nombre: "Synthetic",
      segundo_nombre: null, primer_apellido: "Person", segundo_apellido: null,
    }]);
    if (table === "credenciales") return Response.json(options.emptyCredentials ? [] : [{ id: "credential-id", persona_id: personId, version_actual: 1 }], { headers: { "content-range": options.emptyCredentials ? "*/0" : "0-0/1" } });
    if (table === "credencial_versiones") return Response.json([{ credencial_id: "credential-id", numero_version: 1, titulo: "Synthetic" }]);
    throw new Error(`Unexpected table: ${table}`);
  };
  try {
    await run(records, calls);
    for (const forbidden of [secret, documentNumber, "test-service-key-never-log"])
      assert.equal(logs.join("").includes(forbidden), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

function resolveRequest(body = JSON.stringify({ tipoDocumento: "cc", numeroDocumento: documentNumber }), auth: string | null = authorization) {
  return new Request("http://localhost/api/v1/persons/resolve?secret=untrusted", {
    method: "POST", headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" }, body,
  });
}
function credentialsRequest(id = personId) {
  return GET(new Request(`http://localhost/api/v1/persons/${id}/credentials`, { headers: { authorization } }),
    { params: Promise.resolve({ personId: id }) });
}
function assertAudit(records: Record<string, unknown>[], action: string, status: number, result: string) {
  assert.equal(records.length, 1);
  assert.equal(records[0]!.actor_tipo, "CLIENTE_API");
  assert.equal(records[0]!.actor_id, clientDbId);
  assert.equal(records[0]!.accion, action);
  const metadata = records[0]!.metadata as Record<string, unknown>;
  assert.equal(metadata.http_status, status);
  assert.equal(metadata.resultado, result);
  assert.deepEqual(Object.keys(metadata).sort(), ["endpoint", "http_status", "resultado"]);
  const serialized = JSON.stringify(records);
  for (const forbidden of [secret, authorization, documentNumber, "untrusted", "Synthetic", "test-service-key-never-log"])
    assert.equal(serialized.includes(forbidden), false);
}

test("cliente válido conserva su identidad y scopes", async () => fixture({}, async records => {
  const response = await whoami(new Request("http://localhost/api/v1/auth/client-whoami", { headers: { authorization } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, clientDbId);
  assert.equal(records.length, 0);
}));
test("persons:resolve registra actor, recurso y resultado sin PII", async () => fixture({}, async records => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, personId);
  assertAudit(records, "PERSON_RESOLVE", 200, "OK");
  assert.equal(records[0]!.recurso_id, personId);
}));
test("credentials:read conserva versión y registra auditoría", async () => fixture({}, async records => {
  const response = await credentialsRequest();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data[0].version.numeroVersion, 1);
  assertAudit(records, "CREDENTIALS_READ", 200, "OK");
  assert.equal(records[0]!.recurso_id, personId);
}));
for (const [name, options] of Object.entries({
  inactivo: { state: "SUSPENDIDO" }, revocado: { revoked: true },
  expirado: { expiresAt: "2000-01-01T00:00:00Z" }, incorrecto: { secretHash: hashClientSecret("other") },
})) test(`secreto/cliente ${name}: 401 sin atribuir actor`, async () => fixture(options, async (records, calls) => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 401);
  assert.equal(JSON.stringify(await response.json()).includes(secret), false);
  assert.equal(records.length, 0);
  assert.equal(calls.includes("personas_maestra"), false);
}));
for (const auth of [null, "Basic invalid", "Bearer invalid"]) test(`Authorization inválido: ${auth}`, async () => fixture({}, async (records, calls) => {
  assert.equal((await POST(resolveRequest(undefined, auth))).status, 401);
  assert.equal(records.length, 0);
  assert.equal(calls.length, 0);
}));
test("scope insuficiente deja denegación atribuida sin consultar personas", async () => fixture({ scopes: [] }, async (records, calls) => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 403);
  assertAudit(records, "PERSON_RESOLVE", 403, "DENEGADO");
  assert.equal(calls.includes("personas_maestra"), false);
}));
for (const body of ["{", "{}", JSON.stringify({ tipoDocumento: secret })]) test(`body inválido genera 400 auditado (${body.length})`, async () => fixture({}, async records => {
  const response = await POST(resolveRequest(body));
  assert.equal(response.status, 400);
  assertAudit(records, "PERSON_RESOLVE", 400, "ERROR_VALIDACION");
  assert.equal(JSON.stringify(await response.json()).includes(secret), false);
}));
test("UUID inválido genera 400 auditado antes de consultar la base", async () => fixture({}, async (records, calls) => {
  assert.equal((await credentialsRequest("bad-uuid")).status, 400);
  assertAudit(records, "CREDENTIALS_READ", 400, "ERROR_VALIDACION");
  assert.equal(calls.includes("personas_maestra"), false);
}));
test("persona ausente genera 404 auditado sin identidad documental", async () => fixture({ missingPerson: true }, async records => {
  assert.equal((await POST(resolveRequest())).status, 404);
  assertAudit(records, "PERSON_RESOLVE", 404, "NO_ENCONTRADO");
}));
test("error de lectura no filtra detalles SQL y queda auditado", async () => fixture({ readError: true }, async records => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes(secret), false);
  assertAudit(records, "PERSON_RESOLVE", 500, "ERROR");
}));
for (const options of [{ auditError: true }, { auditThrow: true }]) test(`auditoría fallida impide entrega de datos (${JSON.stringify(options)})`, async () => fixture(options, async records => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AUDIT_UNAVAILABLE", message: "No fue posible registrar la operación; intenta nuevamente" });
  assert.equal(records.length, 0);
}));

test("credentials:read sin scope registra denegación", async () => fixture({ scopes: ["persons:resolve"] }, async (records, calls) => {
  assert.equal((await credentialsRequest()).status, 403);
  assertAudit(records, "CREDENTIALS_READ", 403, "DENEGADO");
  assert.equal(calls.includes("credenciales"), false);
}));
test("persona sin credenciales devuelve lista vacía auditada", async () => fixture({ emptyCredentials: true }, async records => {
  const response = await credentialsRequest();
  assert.deepEqual(await response.json(), { data: [] });
  assertAudit(records, "CREDENTIALS_READ", 200, "OK");
}));
test("fallo de transporte no filtra secretos en respuesta ni logging", async () => fixture({ readThrow: true }, async records => {
  const response = await POST(resolveRequest());
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes(secret), false);
  assertAudit(records, "PERSON_RESOLVE", 500, "ERROR");
}));

test("cuerpo excesivo devuelve 413 auditado sin datos de entrada", async () => fixture({}, async records => {
  const response = await POST(resolveRequest("x".repeat(65537)));
  assert.equal(response.status, 413);
  assertAudit(records, "PERSON_RESOLVE", 413, "ERROR_VALIDACION");
}));
