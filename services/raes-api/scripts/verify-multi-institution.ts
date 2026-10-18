import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";

// Read-only integration against existing data. Never prints documents or secrets.
const base = process.env.RAES_TEST_API_BASE_URL ?? "http://localhost:3101";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const consumerEnv = parse(readFileSync("../credenly-api/.env.local"));
const authorization = `Bearer ${consumerEnv.RAES_CREDENLY_CLIENT_ID}.${consumerEnv.RAES_CREDENLY_CLIENT_SECRET}`;
const db = getRaesSupabaseAdmin();
const query = async (table: string, columns: string) => {
  const result = await db.from(table).select(columns);
  assert.ok(!result.error && result.data, "RAES verification query failed"); return result.data;
};
const [institutions, masters, sources, credentials, operations, versions, events] = await Promise.all([
  query("instituciones", "id,nit"), query("personas_maestra", "id,tipo_documento,numero_documento"),
  query("persona_fuentes", "institucion_id,persona_id,identificador_origen"),
  query("credenciales", "id,institucion_id,persona_id,codigo_origen,estado_actual,version_actual"),
  query("operaciones_api", "credencial_id,tipo_operacion,idempotency_key"),
  query("credencial_versiones", "id,credencial_id,numero_version"),
  query("credencial_eventos", "id,credencial_id"),
]);
const sets: Set<string>[] = [];
const summaries = [];
for (const prefix of ["POLI", "UDEA"]) {
  const env = parse(readFileSync(`../connector-${prefix.toLowerCase()}/.env.local`));
  const source = createClient(env[`${prefix}_SUPABASE_URL`]!, env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`]!, { auth: { persistSession: false, autoRefreshToken: false } });
  const [people, sourceCredentials, institution] = await Promise.all([
    source.from("estudiantes").select("id,tipo_documento,numero_documento"),
    source.from("credenciales").select("id,codigo,estudiante_id,estado"),
    source.from("institucion").select("nit").single(),
  ]);
  assert.ok(!people.error && !sourceCredentials.error && !institution.error, "Source verification query failed");
  const tenant = institutions.find(i => i.nit === institution.data!.nit);
  assert.ok(tenant, "Source institution not registered");
  sets.push(new Set(people.data!.map(p => `${p.tipo_documento}:${p.numero_documento}`)));
  const personMap = new Map<string, string>();
  for (const person of people.data!) {
    const matches = masters.filter(p => p.tipo_documento === person.tipo_documento && p.numero_documento === person.numero_documento);
    assert.ok(matches.length === 1, "Master identity missing or duplicated");
    const match = matches[0]!;
    const links = sources.filter(s => s.institucion_id === tenant.id && s.identificador_origen === person.id);
    assert.ok(links.length === 1 && links[0]!.persona_id === match.id, "Institution source missing, duplicated or assigned incorrectly");
    personMap.set(person.id, match.id);
  }
  let legacyStateMismatches = 0;
  for (const credential of sourceCredentials.data!) {
    const matches = credentials.filter(c => c.institucion_id === tenant.id && c.codigo_origen === credential.codigo);
    assert.ok(matches.length === 1, "Credential missing or duplicated by institution");
    const match = matches[0]!;
    assert.ok(match.persona_id === personMap.get(credential.estudiante_id), "Credential assigned to wrong master");
    const managed = operations.some(o => o.credencial_id === match.id && o.tipo_operacion === "CREDENTIAL_CREATE" && o.idempotency_key === `${prefix.toLowerCase()}:create:${credential.id}`);
    const expectedState = credential.estado === "REVOCADO" ? "REVOCADA" : credential.estado === "ANULADO" ? "ANULADA" : "VIGENTE";
    if (managed) assert.ok(match.estado_actual === expectedState, "Managed credential state differs from source");
    else if (match.estado_actual !== expectedState) legacyStateMismatches++;
    assert.ok(versions.some(v => v.credencial_id === match.id && v.numero_version === match.version_actual), "Current version missing");
    assert.ok(events.some(e => e.credencial_id === match.id), "Credential event missing");
  }
  // Consumer API must return every credential of an existing person from this source.
  const person = people.data![0]!;
  const resolved = await fetch(`${base}/api/v1/persons/resolve`, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ tipoDocumento: person.tipo_documento, numeroDocumento: person.numero_documento }) });
  assert.ok(resolved.status === 200, "Consumer person resolution failed");
  const personId = (await resolved.json()).data.id;
  const read = await fetch(`${base}/api/v1/persons/${personId}/credentials`, { headers: { authorization } });
  assert.ok(read.status === 200, "Consumer credentials read failed");
  const returned = (await read.json()).data as { id: string }[];
  const expected = credentials.filter(c => c.persona_id === personId);
  assert.ok(returned.length === expected.length && expected.every(c => returned.some(r => r.id === c.id)), "Consumer API omitted credentials");
  // Same source code with the other tenant's identity must not disclose data.
  const otherPrefix = prefix === "POLI" ? "UDEA" : "POLI";
  const otherEnv = parse(readFileSync(`../connector-${otherPrefix.toLowerCase()}/.env.local`));
  const code = sourceCredentials.data!.find(c => !credentials.some(r => r.institucion_id !== tenant.id && r.codigo_origen === c.codigo))!.codigo;
  const foreign = await fetch(`${base}/api/v1/credentials/source/${encodeURIComponent(code)}`, { headers: { authorization: `Bearer ${otherEnv[`RAES_${otherPrefix}_CLIENT_ID`]}.${otherEnv[`RAES_${otherPrefix}_CLIENT_SECRET`]}` } });
  assert.ok(foreign.status === 404, "Institutional isolation failed");
  summaries.push({ source: prefix, persons: people.data!.length, sourceCredentials: sourceCredentials.data!.length, foreignRead: foreign.status, legacyStateMismatches });
}
const intersection = [...sets[0]!].filter(id => sets[1]!.has(id)).length;
// Live Credenly service integration for its existing verified citizen link.
Object.assign(process.env, consumerEnv, { RAES_API_BASE_URL: base });
const citizenDb = createClient(consumerEnv.CREDENLY_SUPABASE_URL!, consumerEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const linked = await citizenDb.from("vinculaciones_raes").select("usuario_id,raes_persona_id").eq("estado", "VERIFICADA").limit(1).single();
assert.ok(!linked.error && linked.data, "Existing verified citizen link required");
const { getLiveCredentialsForUser } = await import("../../credenly-api/src/lib/raes-link");
const live = await getLiveCredentialsForUser(linked.data.usuario_id);
assert.ok(live.length === credentials.filter(c => c.persona_id === linked.data.raes_persona_id).length, "Credenly service omitted credentials");
console.log(JSON.stringify({ institutions: summaries, sharedSourceIdentities: intersection, realSharedPersonScenario: intersection > 0 ? "AVAILABLE" : "PENDING_DATASET", credenlyLiveServiceRead: "OK", credenlyAcademicWrites: 0, academicMutations: 0 }));
