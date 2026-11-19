import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { isCredentials } from "../src/lib/citizen-model";

// Approved synthetic C/D identity only. No existing users or academic records
// are modified. Operator keys/password/session/share URL never enter reports.
assert.ok(process.argv.includes("--temporary-citizen"));
const base = "http://localhost:3206",
  api = "http://localhost:3102";
assert.equal(
  new URL(process.env.CREDENLY_SUPABASE_URL!).hostname,
  "rleocqxvahtbswclqmif.supabase.co",
);
const db = createClient(
  process.env.CREDENLY_SUPABASE_URL!,
  process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const publicTables = [
  "perfiles",
  "verificaciones_identidad",
  "vinculaciones_raes",
  "comparticiones",
  "accesos_compartidos",
];
async function snapshot() {
  const result: Record<string, { count: number; hash: string }> = {};
  for (const table of publicTables) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await db
        .from(table)
        .select("*")
        .order("id")
        .range(offset, offset + 999);
      assert.ok(!page.error && page.data, "Snapshot unavailable");
      rows.push(...page.data);
      if (page.data.length < 1000) break;
    }
    result[table] = {
      count: rows.length,
      hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  return result;
}
const before = await snapshot();
const master = "daf57960-31cb-432b-8e45-684c63651f85";
const existing = await db
  .from("vinculaciones_raes")
  .select("id")
  .eq("raes_persona_id", master);
assert.ok(
  !existing.error && existing.data?.length === 0,
  "Stop: approved fixture already linked; do not modify existing users",
);
const email = `synthetic-frontend-${randomUUID()}@example.invalid`,
  password = randomBytes(32).toString("base64url");
let loggedOut = false;
let stage = "setup";
const verificationId = randomUUID();
let userId: string | undefined,
  token: string | undefined,
  shareIds: string[] = [];
const browser = await chromium.launch(chromiumLaunchOptions);
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
const origins = new Set<string>();
page.on("pageerror", (e) => errors.push(e.name));
page.on("request", (r) => origins.add(new URL(r.url()).origin));
async function sessionToken() {
  const raw = (await context.cookies())
    .filter((c) => c.name.startsWith("credenly-web-auth"))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((c) => c.value)
    .join("");
  return raw
    ? (
        JSON.parse(
          raw.startsWith("base64-")
            ? Buffer.from(raw.slice(7), "base64url").toString()
            : raw,
        ) as { access_token: string }
      ).access_token
    : undefined;
}
mkdirSync("/tmp/frontend-qa", { recursive: true });
try {
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ok(
    !created.error && created.data.user,
    "Synthetic account creation failed",
  );
  userId = created.data.user.id;
  await page.goto(`${base}/credentials`);
  await page.waitForURL("**/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL("**/onboarding");
  token = await sessionToken();
  assert.ok(token);
  const cookies = (await context.cookies()).filter((c) =>
    c.name.startsWith("credenly-web-auth"),
  );
  assert.ok(
    cookies.length && cookies.every((c) => c.httpOnly && c.sameSite === "Lax"),
  );
  await page.getByLabel("Nombres", { exact: true }).fill("Sintetica");
  await page.getByLabel("Apellidos", { exact: true }).fill("Multiinstitucion");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await page.getByText("Perfil guardado.", { exact: true }).waitFor();
  // Controlled approved verification fixture, explicitly not a real OCR/KYC claim.
  const verification = await db
    .from("verificaciones_identidad")
    .insert({
      id: verificationId,
      usuario_id: userId,
      tipo_documento_extraido: "CC",
      numero_documento_extraido: "SYNTH-CD-20261018-001",
      nombres_extraidos: "Sintetica",
      apellidos_extraidos: "Multiinstitucion",
      estado: "APROBADA",
      proveedor_ocr: "MOCK_DESARROLLO",
      motivo_revision: "Fixture temporal frontend; no acredita identidad real.",
      processed_at: new Date().toISOString(),
      imagen_eliminada_at: new Date().toISOString(),
    });
  assert.ok(!verification.error, "Synthetic verification preparation failed");
  await page.reload();
  await page.getByRole("button", { name: "Vincular con RAES" }).click();
  await page.getByText("Identidad vinculada", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Ir a mis credenciales" }).click();
  await page.waitForURL("**/credentials");
  stage = "credentials-http";
  const http = await fetch(`${api}/api/v1/credentials`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(http.status, 200);
  stage = "credentials-payload";
  const payload: unknown = await http.json();
  assert.ok(isCredentials(payload));
  stage = "credentials-identifiers";
  assert.deepEqual(
    payload.data.map((c) => c.id).sort(),
    [
      "981200b3-a30c-4088-ae09-84b27beab01b",
      "b80fb8d4-6a6c-4453-948a-62018be8b7b6",
    ].sort(),
  );
  assert.equal(new Set(payload.data.map((c) => c.institucion?.id)).size, 2);
  stage = "credentials-render";
  await expect(page.getByRole("article")).toHaveCount(2, { timeout: 15000 });
  stage = "credentials-responsive";
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Credentials overflow at ${width}`,
    );
    await page.screenshot({
      path: `/tmp/frontend-qa/credenly-real-${width}.png`,
      fullPage: true,
    });
  }
  stage = "credential-detail";
  for (const c of payload.data) {
    await page.goto(`${base}/credentials/${c.id}`);
    await page
      .getByRole("heading", { name: c.version?.titulo ?? c.tipo, exact: true })
      .waitFor();
  }
  stage = "share-create";
  await page.goto(`${base}/shares?credential=${payload.data[0]!.id}`);
  await page.getByLabel("Duración en horas").fill("1");
  await page.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await page.getByLabel("Enlace de verificación").waitFor();
  const shareUrl = await page.getByLabel("Enlace de verificación").inputValue();
  assert.equal(new URL(shareUrl).origin, base);
  const shares = await db
    .from("comparticiones")
    .select("id")
    .eq("usuario_id", userId);
  assert.ok(!shares.error && shares.data?.length === 1);
  shareIds = shares.data.map((s) => s.id);
  await page.getByRole("button", { name: "Cerrar enlace" }).click();
  assert.equal(await page.getByLabel("Enlace de verificación").count(), 0);
  stage = "public-verification";
  const publicPage = await context.newPage();
  await publicPage.goto(shareUrl);
  await publicPage
    .getByRole("heading", { name: "Estado actual de la credencial" })
    .waitFor();
  await publicPage
    .getByText(
      "Información consultada desde RAES. El resultado corresponde al estado actual.",
    )
    .waitFor();
  await publicPage.close();
  stage = "share-revoke";
  await page.getByRole("button", { name: "Revocar acceso" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await page.getByText("Revocada", { exact: true }).waitFor();
  await page.goto(shareUrl);
  await page
    .getByRole("heading", { name: "Enlace revocado", exact: true })
    .waitFor();
  await page.goto(
    `${base}/verify/crdn_shr_${randomBytes(32).toString("base64url")}`,
  );
  await page
    .getByRole("heading", { name: "Información no disponible", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await page.goto(`${base}/credentials`);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForURL("**/login");
  loggedOut = true;
  await page.goto(`${base}/credentials`);
  await page.waitForURL("**/login");
  assert.deepEqual(errors, []);
  assert.deepEqual([...origins], [base]);
} catch (e) {
  throw new Error(
    `Real citizen QA failed (${e instanceof Error ? e.name : "Unknown"}), stage=${stage}, section=${new URL(page.url()).pathname.split("/")[1]}; no secret diagnostics saved`,
  );
} finally {
  if (userId) {
    token ??= await sessionToken();
    if (token && !loggedOut) {
      const revoke = await db.auth.admin.signOut(token, "global");
      assert.ok(!revoke.error, `Stop: session cleanup failed for ${userId}`);
    }
    // Discover only shares owned by this invocation, even if UI failed mid-creation.
    const shares = await db
      .from("comparticiones")
      .select("id")
      .eq("usuario_id", userId);
    assert.ok(!shares.error && shares.data);
    shareIds = shares.data.map((s) => s.id);
    if (shareIds.length) {
      const logs = await db
        .from("accesos_compartidos")
        .delete()
        .in("comparticion_id", shareIds);
      assert.ok(!logs.error, `Stop: share access cleanup failed for ${userId}`);
    }
    for (const table of [
      "comparticiones",
      "vinculaciones_raes",
      "verificaciones_identidad",
      "perfiles",
    ]) {
      const field = table === "perfiles" ? "id" : "usuario_id";
      const removed = await db.from(table).delete().eq(field, userId);
      assert.ok(!removed.error, `Stop: ${table} cleanup failed for ${userId}`);
      const check = await db.from(table).select(field).eq(field, userId);
      assert.ok(
        !check.error && check.data?.length === 0,
        `Stop: ${table} residue for ${userId}`,
      );
    }
    const deleted = await db.auth.admin.deleteUser(userId);
    assert.ok(!deleted.error, `Stop: Auth cleanup failed for ${userId}`);
    const check = await db.auth.admin.getUserById(userId);
    assert.equal(check.error?.status, 404);
  }
  await browser.close();
}
assert.deepEqual(
  await snapshot(),
  before,
  "Stop: Credenly public data changed after cleanup",
);
if (token)
  assert.equal(
    (
      await fetch(`${api}/api/v1/credentials`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    401,
  );
console.log(
  JSON.stringify({
    citizenBrowser: "REAL_API_OK",
    authenticatedCredentials: 200,
    credentials: [
      "981200b3-a30c-4088-ae09-84b27beab01b",
      "b80fb8d4-6a6c-4453-948a-62018be8b7b6",
    ],
    institutions: 2,
    source: "RAES",
    persistedByCredenly: false,
    publicVerification: "AVAILABLE_REVOKED_NOT_FOUND_OK",
    temporaryUserId: userId,
    temporaryVerificationId: verificationId,
    temporaryShareIds: shareIds,
    temporaryCitizenRemoved: true,
    publicTablesAfterCleanup: "IDENTICAL_HASHES_5_TABLES",
    sessionAfterCleanup: 401,
    verificationFixture: "MOCK_DESARROLLO_NOT_REAL_OCR",
    widths: [360, 768, 1024, 1440],
    hydrationErrors: 0,
  }),
);
