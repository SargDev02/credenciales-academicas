import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getCredenlySupabaseAdmin } from "../src/lib/supabase-admin";
import { getServerEnv } from "../src/lib/env";
import { resolveRaesPerson, getRaesCredentialsForPerson } from "../src/lib/raes-client";
import { linkApprovedVerificationToRaes, getLiveCredentialsForUser } from "../src/lib/raes-link";

// Explicit opt-in: creates only a temporary synthetic citizen/verification/link.
// No emails, real OCR, academic writes or changes to existing users. Always cleans up.
assert.ok(process.argv.includes("--temporary-citizen"), "Requires explicit --temporary-citizen authorization");
const base = process.env.CREDENLY_TEST_API_BASE_URL ?? "http://localhost:3102";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const env = getServerEnv();
assert.equal(new URL(env.CREDENLY_SUPABASE_URL).hostname, "rleocqxvahtbswclqmif.supabase.co", "Development project required");
const db = getCredenlySupabaseAdmin();
const person = await resolveRaesPerson({ tipoDocumento: "CC", numeroDocumento: "SYNTH-CD-20261018-001" });
const expected = await getRaesCredentialsForPerson(person.id);
assert.equal(expected.length, 2);
assert.equal(new Set(expected.map(c => c.institucion?.id)).size, 2);
const alreadyLinked = await db.from("vinculaciones_raes").select("id").eq("raes_persona_id", person.id);
assert.ok(!alreadyLinked.error && alreadyLinked.data?.length === 0, "Shared fixture already linked; do not alter existing accounts");
const email = `synthetic-cd-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString("base64url");
const verificationId = randomUUID();
const sessionClient = createClient(env.CREDENLY_SUPABASE_URL, env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
let userId: string | undefined;
let accessToken: string | undefined;
try {
  const user = await db.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { test_fixture: "PR14_SYNTHETIC_CD_TEMPORARY" } });
  assert.ok(!user.error && user.data.user, "Could not create temporary synthetic citizen");
  userId = user.data.user.id;
  const profile = await db.from("perfiles").select("id").eq("id", userId).maybeSingle();
  assert.ok(!profile.error, "Could not check temporary profile");
  if (!profile.data) {
    const result = await db.from("perfiles").insert({ id: userId, nombres: "Sintetica", apellidos: "Multiinstitucion" });
    assert.ok(!result.error, "Could not create temporary profile");
  }
  const verification = await db.from("verificaciones_identidad").insert({
    id: verificationId, usuario_id: userId, tipo_documento_extraido: "CC", numero_documento_extraido: "SYNTH-CD-20261018-001",
    nombres_extraidos: "Sintetica", apellidos_extraidos: "Multiinstitucion", estado: "APROBADA",
    proveedor_ocr: "MOCK_DESARROLLO", motivo_revision: "Fixture sintetico temporal PR14; no acredita identidad real.",
    processed_at: new Date().toISOString(), imagen_eliminada_at: new Date().toISOString(),
  });
  assert.ok(!verification.error, "Could not prepare synthetic approved verification");
  const link = await linkApprovedVerificationToRaes(userId, verificationId);
  assert.equal(link.raes_persona_id, person.id);
  const live = await getLiveCredentialsForUser(userId);
  assert.deepEqual(live.map(c => c.id).sort(), expected.map(c => c.id).sort());
  const login = await sessionClient.auth.signInWithPassword({ email, password });
  assert.ok(!login.error && login.data.session, "Temporary citizen sign-in failed");
  accessToken = login.data.session.access_token;
  const result = await fetch(`${base}/api/v1/credentials`, { headers: { authorization: `Bearer ${accessToken}` } });
  assert.equal(result.status, 200, "Credenly authenticated HTTP read failed");
  const payload = await result.json();
  assert.equal(payload.source, "RAES"); assert.equal(payload.persistedByCredenly, false);
  assert.equal(payload.data.length, 2);
  for (const credential of expected) assert.ok(payload.data.some((c: { id: string; institucion: { id: string } }) =>
    c.id === credential.id && c.institucion.id === credential.institucion?.id), "Credenly HTTP omitted institution provenance");
} finally {
  // Only identifiers created by this invocation may be removed.
  if (userId) {
    const cleanupFailures: string[] = [];
    try {
      const signedOut = await sessionClient.auth.signOut({ scope: "global" });
      if (signedOut.error) cleanupFailures.push("session revocation");
    } catch { cleanupFailures.push("session revocation"); }
    for (const table of ["vinculaciones_raes", "verificaciones_identidad"]) {
      try {
        const cleanup = await db.from(table).delete().eq("usuario_id", userId);
        if (cleanup.error) cleanupFailures.push(table);
      } catch { cleanupFailures.push(table); }
    }
    const deleted = await db.auth.admin.deleteUser(userId);
    assert.ok(!deleted.error, `Temporary auth user cleanup failed; review user ${userId}`);
    for (const table of ["perfiles", "vinculaciones_raes", "verificaciones_identidad"]) {
      const rows = await db.from(table).select(table === "perfiles" ? "id" : "usuario_id").eq(table === "perfiles" ? "id" : "usuario_id", userId);
      assert.ok(!rows.error && rows.data?.length === 0, `Temporary citizen data remains; review user ${userId}`);
    }
    assert.deepEqual(cleanupFailures, [], "Cleanup had failures; review verified removal and session revocation");
  }
}
assert.ok(accessToken && userId, "Authenticated read was not completed");
const after = await fetch(`${base}/api/v1/credentials`, { headers: { authorization: `Bearer ${accessToken}` } });
assert.equal(after.status, 401, "Deleted temporary citizen still authenticates");
console.log(JSON.stringify({ masterPersonId: person.id, credentials: expected.map(c => ({ id: c.id, institutionId: c.institucion?.id })),
  authenticatedHttp: 200, source: "RAES", persistedByCredenly: false, academicWrites: 0,
  temporaryCitizenId: userId, temporaryCitizenRemoved: true, sessionAfterCleanup: after.status,
  verification: "SYNTHETIC_MOCK_DEVELOPMENT_NOT_REAL_OCR" }));
