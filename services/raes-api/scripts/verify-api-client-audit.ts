import assert from "node:assert/strict";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";
import { formatApiBearer } from "../src/lib/api-credentials";

// Uses existing local credentials; prints statuses/counts only. Reads existing
// synthetic academic data and appends audit records without academic mutations.
const baseUrl = process.env.RAES_AUDIT_TEST_API_BASE_URL ?? "http://localhost:3101";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname));
const clientId = process.env.RAES_CREDENLY_CLIENT_ID;
const secret = process.env.RAES_CREDENLY_CLIENT_SECRET;
assert.ok(clientId && secret, "Missing local Credenly service configuration");
const authorization = formatApiBearer(clientId, secret);
const supabase = getRaesSupabaseAdmin();
const { data: client, error: clientError } = await supabase.from("clientes_api")
  .select("id").eq("client_id", clientId).single();
assert.equal(clientError, null);
const { data: person, error: personError } = await supabase.from("personas_maestra")
  .select("id,tipo_documento,numero_documento").limit(1).single();
assert.equal(personError, null);
assert.ok(person);
const startedAt = new Date().toISOString();
const headers = { authorization, "content-type": "application/json" };
const whoami = await fetch(`${baseUrl}/api/v1/auth/client-whoami`, { headers });
assert.equal(whoami.status, 200);
const resolved = await fetch(`${baseUrl}/api/v1/persons/resolve`, {
  method: "POST", headers,
  body: JSON.stringify({ tipoDocumento: person.tipo_documento, numeroDocumento: person.numero_documento }),
});
assert.equal(resolved.status, 200);
assert.equal((await resolved.json()).data.id, person.id);
const credentials = await fetch(`${baseUrl}/api/v1/persons/${person.id}/credentials`, { headers });
assert.equal(credentials.status, 200);
assert.ok(Array.isArray((await credentials.json()).data));
const invalid = await fetch(`${baseUrl}/api/v1/persons/invalid/credentials`, { headers });
assert.equal(invalid.status, 400);
const malformed = await fetch(`${baseUrl}/api/v1/persons/resolve`, { method: "POST", headers, body: "{" });
assert.equal(malformed.status, 400);
const unauthorized = await fetch(`${baseUrl}/api/v1/persons/resolve`, {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}",
});
assert.equal(unauthorized.status, 401);
const { data: audit, error: auditError } = await supabase.from("auditoria")
  .select("actor_tipo,actor_id,accion,recurso_tipo,recurso_id,metadata,created_at,ip,user_agent")
  .eq("actor_tipo", "CLIENTE_API").eq("actor_id", client!.id).gte("created_at", startedAt);
assert.equal(auditError, null);
assert.ok(audit && audit.length >= 4);
for (const action of ["PERSON_RESOLVE", "CREDENTIALS_READ"]) {
  assert.ok(audit.some(row => row.accion === action && row.metadata.http_status === 200 && row.recurso_id === person.id));
  assert.ok(audit.some(row => row.accion === action && row.metadata.http_status === 400));
}
for (const row of audit) {
  assert.deepEqual(Object.keys(row.metadata).sort(), ["endpoint", "http_status", "resultado"]);
  assert.equal(row.ip, null);
  assert.equal(row.user_agent, null);
  for (const forbidden of [secret, authorization, person.numero_documento]) {
    assert.equal(JSON.stringify(row).includes(forbidden), false);
  }
}
console.log(JSON.stringify({ authentication: 200, personResolve: 200,
  credentialsRead: 200, invalidUuid: 400, invalidJson: 400,
  missingAuthorization: 401, verifiedAuditRecords: audit.length, academicMutations: 0 }));
