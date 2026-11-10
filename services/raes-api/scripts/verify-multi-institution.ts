import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";

// Read-only integration against institutional fixtures. No academic or citizen writes.
const fixtureDocument = "SYNTH-CD-20261018-001";
const baselinePath = process.argv.find(a => a.startsWith("--record-baseline="))?.split("=", 2)[1];
const comparePath = process.argv.find(a => a.startsWith("--compare-baseline="))?.split("=", 2)[1];
assert.ok(!(baselinePath && comparePath), "Choose either record or compare baseline");
const base = process.env.RAES_TEST_API_BASE_URL ?? "http://localhost:3101";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const consumerEnv = parse(readFileSync("../credenly-api/.env.local"));
const authorization = `Bearer ${consumerEnv.RAES_CREDENLY_CLIENT_ID}.${consumerEnv.RAES_CREDENLY_CLIENT_SECRET}`;
const db = getRaesSupabaseAdmin();
type MasterRow = { id: string; tipo_documento: string; numero_documento: string };
type SourceRow = { id: string; institucion_id: string; persona_id: string; identificador_origen: string };
type CredentialRow = { id: string; institucion_id: string; persona_id: string; codigo_origen: string; estado_actual: string; version_actual: number; created_at: string };
type OperationRow = { id: string; credencial_id: string; integracion_id: string; tipo_operacion: string; idempotency_key: string; received_at: string };
const query = async <T>(table: string, columns: string): Promise<T[]> => {
  const result = await db.from(table).select(columns);
  assert.ok(!result.error && result.data, "RAES verification query failed"); return result.data as unknown as T[];
};
const [institutions, masters, sources, credentials, operations, versions, events] = await Promise.all([
  query<{ id: string; nit: string }>("instituciones", "id,nit"), query<MasterRow>("personas_maestra", "id,tipo_documento,numero_documento"),
  query<SourceRow>("persona_fuentes", "id,institucion_id,persona_id,identificador_origen"),
  query<CredentialRow>("credenciales", "*"),
  query<OperationRow>("operaciones_api", "id,credencial_id,integracion_id,tipo_operacion,idempotency_key,received_at"),
  query<{ id: string; credencial_id: string; numero_version: number }>("credencial_versiones", "*"),
  query<{ id: string; credencial_id: string }>("credencial_eventos", "*"),
]);
const sets: Set<string>[] = [];
const summaries = [];
const sharedCredentials: { id: string; institutionId: string; sourceId: string; sourceCode: string }[] = [];
const legacyEvidence = [];
for (const prefix of ["POLI", "UDEA"]) {
  const env = parse(readFileSync(`../connector-${prefix.toLowerCase()}/.env.local`));
  const source = createClient(env[`${prefix}_SUPABASE_URL`]!, env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`]!, { auth: { persistSession: false, autoRefreshToken: false } });
  const [people, sourceCredentials, institution] = await Promise.all([
    source.from("estudiantes").select("id,tipo_documento,numero_documento"),
    source.from("credenciales").select("id,codigo,estudiante_id,estado"),
    source.from("institucion").select("nit").single(),
  ]);
  assert.ok(!people.error && !sourceCredentials.error && !institution.error, "Source verification query failed");
  assert.ok(people.data && sourceCredentials.data && institution.data, "Source rows missing");
  const sourcePeople: MasterRow[] = people.data;
  const sourceRows: { id: string; codigo: string; estudiante_id: string; estado: string }[] = sourceCredentials.data;
  const tenant = institutions.find(i => i.nit === institution.data.nit);
  assert.ok(tenant, "Source institution not registered");
  sets.push(new Set(sourcePeople.map(p => `${p.tipo_documento}:${p.numero_documento}`)));
  const personMap = new Map<string, string>();
  for (const person of sourcePeople) {
    const matches = masters.filter(p => p.tipo_documento === person.tipo_documento && p.numero_documento === person.numero_documento);
    assert.ok(matches.length === 1, "Master identity missing or duplicated");
    const match = matches[0]!;
    const links = sources.filter(s => s.institucion_id === tenant.id && s.identificador_origen === person.id);
    assert.ok(links.length === 1 && links[0]!.persona_id === match.id, "Institution source missing, duplicated or assigned incorrectly");
    personMap.set(person.id, match.id);
  }
  let legacyStateMismatches = 0;
  for (const credential of sourceRows) {
    const matches: CredentialRow[] = credentials.filter(c => c.institucion_id === tenant.id && c.codigo_origen === credential.codigo);
    assert.ok(matches.length === 1, "Credential missing or duplicated by institution");
    const match: CredentialRow = matches[0]!;
    assert.ok(match.persona_id === personMap.get(credential.estudiante_id), "Credential assigned to wrong master");
    const managed = operations.some(o => o.credencial_id === match.id && o.tipo_operacion === "CREDENTIAL_CREATE" && o.idempotency_key === `${prefix.toLowerCase()}:create:${credential.id}`);
    const expectedState = credential.estado === "REVOCADO" ? "REVOCADA" : credential.estado === "ANULADO" ? "ANULADA" : "VIGENTE";
    if (managed) assert.ok(match.estado_actual === expectedState, "Managed credential state differs from source");
    else if (match.estado_actual !== expectedState) legacyStateMismatches++;
    const sourcePerson = sourcePeople.find(p => p.id === credential.estudiante_id)!;
    if (sourcePerson.numero_documento === fixtureDocument) {
      assert.ok(managed && match.version_actual === 1 && match.estado_actual === "VIGENTE", "Shared fixture was not created through its connector");
      const fixturePrefix = prefix === "POLI" ? "a" : "b";
      assert.equal(sourcePerson.id, `${fixturePrefix}0182026-1018-4000-8000-000000000001`);
      assert.equal(credential.id, `${fixturePrefix}0182026-1018-4000-8000-000000000003`);
      assert.equal(credential.codigo, `SYNTH-${prefix}-CD-20261018-001`);
      assert.equal(versions.filter(v => v.credencial_id === match.id).length, 1);
      assert.equal(events.filter(e => e.credencial_id === match.id).length, 1);
      sharedCredentials.push({ id: match.id, institutionId: tenant.id, sourceId: credential.id, sourceCode: credential.codigo });
    }
    if (!managed) {
      const creation = operations.find(o => o.credencial_id === match.id && o.tipo_operacion === "CREDENTIAL_CREATE");
      assert.ok(creation, "Unmanaged record lacks original creation evidence; review ownership");
      assert.notEqual(creation.idempotency_key, `${prefix.toLowerCase()}:create:${credential.id}`);
      legacyEvidence.push({ code: credential.codigo, credentialId: match.id, originalCreationKey: creation.idempotency_key,
        expectedConnectorKey: `${prefix.toLowerCase()}:create:${credential.id}`, createdAt: match.created_at,
        state: match.estado_actual, version: match.version_actual, preserved: true });
    }
    assert.ok(versions.some(v => v.credencial_id === match.id && v.numero_version === match.version_actual), "Current version missing");
    assert.ok(events.some(e => e.credencial_id === match.id), "Credential event missing");
  }
  // Consumer API must return every credential of an existing person from this source.
  const person = sourcePeople[0]!;
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
  const code = sourceRows.find(c => !credentials.some(r => r.institucion_id !== tenant.id && r.codigo_origen === c.codigo))!.codigo;
  const foreign = await fetch(`${base}/api/v1/credentials/source/${encodeURIComponent(code)}`, { headers: { authorization: `Bearer ${otherEnv[`RAES_${otherPrefix}_CLIENT_ID`]}.${otherEnv[`RAES_${otherPrefix}_CLIENT_SECRET`]}` } });
  assert.ok(foreign.status === 404, "Institutional isolation failed");
  summaries.push({ source: prefix, persons: sourcePeople.length, sourceCredentials: sourceRows.length, foreignRead: foreign.status, legacyStateMismatches });
}
const intersection = [...sets[0]!].filter(id => sets[1]!.has(id));
assert.deepEqual(intersection, [`CC:${fixtureDocument}`], "Expected exactly the approved shared synthetic identity");
const sharedMasters = masters.filter(p => p.tipo_documento === "CC" && p.numero_documento === fixtureDocument);
assert.equal(sharedMasters.length, 1);
const master = sharedMasters[0]!;
const sharedSources = sources.filter(s => s.persona_id === master.id);
assert.equal(sharedSources.length, 2);
assert.equal(new Set(sharedSources.map(s => s.institucion_id)).size, 2);
assert.equal(new Set(sharedSources.map(s => s.identificador_origen)).size, 2);
assert.equal(sharedCredentials.length, 2);
assert.equal(credentials.filter(c => c.persona_id === master.id).length, 2);
const returned = await fetch(`${base}/api/v1/persons/${master.id}/credentials`, { headers: { authorization } });
assert.equal(returned.status, 200);
const raesShared = (await returned.json()).data as { id: string; institucion: { id: string } }[];
function assertSharedResult(rows: { id: string; institucion: { id: string } | null }[]) {
  assert.equal(rows.length, 2);
  for (const expected of sharedCredentials) assert.ok(rows.some(r => r.id === expected.id && r.institucion?.id === expected.institutionId), "Shared credential provenance mismatch");
}
assertSharedResult(raesShared);
// Real Credenly outbound service: all academic reads go through RAES HTTP.
// No account/link is created or changed by this read-only verifier.
Object.assign(process.env, consumerEnv, { RAES_API_BASE_URL: base });
const { resolveRaesPerson, getRaesCredentialsForPerson } = await import("../../credenly-api/src/lib/raes-client");
const resolvedByCredenly = await resolveRaesPerson({ tipoDocumento: "CC", numeroDocumento: fixtureDocument });
assert.equal(resolvedByCredenly.id, master.id);
assertSharedResult(await getRaesCredentialsForPerson(master.id));
const citizenDb = createClient(consumerEnv.CREDENLY_SUPABASE_URL!, consumerEnv.CREDENLY_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const linked = await citizenDb.from("vinculaciones_raes").select("usuario_id,raes_persona_id").eq("estado", "VERIFICADA").limit(1).single();
assert.ok(!linked.error && linked.data, "Existing verified citizen link required");
const { getLiveCredentialsForUser } = await import("../../credenly-api/src/lib/raes-link");
const live = await getLiveCredentialsForUser(linked.data.usuario_id);
assert.ok(live.length === credentials.filter(c => c.persona_id === linked.data.raes_persona_id).length, "Credenly service omitted credentials");
// Compare stable identities/lineage and full academic records across connector runs.
// Hashes only are persisted locally; no snapshots of documents or credentials.
function fingerprint(rows: Record<string, unknown>[]) {
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
    return JSON.stringify(value);
  }
  return { count: rows.length, sha256: createHash("sha256").update(canonical([...rows].sort((a,b) => String(a.id).localeCompare(String(b.id))))).digest("hex") };
}
const snapshot = Object.fromEntries(Object.entries({ masters, sources, credentials, operations, versions, events }).map(([name, rows]) => [name, fingerprint(rows)]));
if (baselinePath) writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
if (comparePath) assert.deepEqual(snapshot, JSON.parse(readFileSync(comparePath, "utf8")), "Connector replay changed identities, lineage, credentials, operations, versions or events");
console.log(JSON.stringify({ institutions: summaries, sharedSourceIdentities: intersection.length,
  sharedPerson: { id: master.id, sources: sharedSources.length, credentials: sharedCredentials },
  realSharedPersonScenario: "C_D_OK", credenlySharedLiveClientRead: "OK", credenlyExistingCitizenServiceRead: "OK",
  replay: comparePath ? "IDENTICAL" : baselinePath ? "BASELINE_RECORDED" : "NOT_COMPARED",
  totals: Object.fromEntries(Object.entries(snapshot).map(([name, row]) => [name, row.count])),
  legacyEvidence, credenlyAcademicWrites: 0, academicMutations: 0 }));
