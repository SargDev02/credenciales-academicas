import assert from "node:assert/strict";
import { getCredenlySupabaseAdmin } from "../src/lib/supabase-admin";
import { getLiveCredentialsForUser } from "../src/lib/raes-link";
import { createShare, revokeShare } from "../src/lib/sharing";

// Existing verified test citizen; no login impersonation or academic mutations.
// Creates an unguessable test link, exercises the public HTTP route, then revokes it.
const base = process.env.CREDENLY_TEST_API_BASE_URL ?? "http://localhost:3102";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = getCredenlySupabaseAdmin();
const linked = await db.from("vinculaciones_raes").select("usuario_id").eq("estado", "VERIFICADA").limit(1).single();
assert.ok(!linked.error && linked.data, "Existing verified test citizen required");
const userId = linked.data.usuario_id;
const credentials = await getLiveCredentialsForUser(userId);
assert.ok(credentials[0], "Existing RAES credential required");
let shareId: string | undefined;
let revoked = false;
try {
  const share = await createShare(userId, { raesCredencialId: credentials[0].id, expiresInHours: 1, camposVisibles: [] });
  shareId = share.share.id;
  const url = `${base}${share.publicPath}`;
  const result = await fetch(url, { headers: { "x-forwarded-for": "203.0.113.1" } });
  assert.ok(result.status === 200, "Public share verification failed");
  const payload = (await result.json()).data;
  assert.ok(payload.source === "RAES" && payload.persistedByCredenly === false, "Academic provenance missing");
  await revokeShare(userId, shareId);
  revoked = true;
  const after = await fetch(url);
  assert.ok(after.status === 410 && (await after.json()).error === "SHARE_REVOKED", "Revoked link still accessible");
  const audit = await db.from("accesos_compartidos").select("resultado,ip_hash").eq("comparticion_id", shareId);
  assert.ok(!audit.error && audit.data?.some(a => a.resultado === "OK") && audit.data.some(a => a.resultado === "ENLACE_REVOCADO"), "Access audit incomplete");
  assert.ok(audit.data.every(a => !a.ip_hash || /^[a-f0-9]{64}$/.test(a.ip_hash)), "Invalid IP pseudonym");
  const stored = await db.from("comparticiones").select("token_hash,revoked_at").eq("id", shareId).single();
  assert.ok(!stored.error && stored.data?.token_hash !== share.token && stored.data?.revoked_at, "Share cleanup/hash validation failed");
  console.log(JSON.stringify({ publicAccess: 200, revokedAccess: 410, accessAudit: "OK", source: "RAES", persistedByCredenly: false, testShareRevoked: true }));
} finally {
  if (shareId && !revoked) await revokeShare(userId, shareId);
}
