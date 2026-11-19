import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { isInstitutions, isAdminProfile } from "../src/lib/admin-model";

// Operator-only QA. Backend service credentials never enter either web process.
// Password/session stay in memory; no storageState, HAR, traces or video are saved.
assert.ok(
  process.argv.includes("--temporary-admin"),
  "Explicit --temporary-admin required",
);
const base = process.env.RAES_WEB_TEST_BASE_URL ?? "http://localhost:3200";
const api = process.env.RAES_TEST_API_BASE_URL ?? "http://localhost:3101";
for (const url of [base, api])
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
assert.equal(
  new URL(process.env.RAES_SUPABASE_URL!).hostname,
  "xldjndaunxziiymvwsji.supabase.co",
);
const db = createClient(
  process.env.RAES_SUPABASE_URL!,
  process.env.RAES_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const email = `synthetic-frontend-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString("base64url");
const browser = await chromium.launch(chromiumLaunchOptions);
const context = await browser.newContext();
const page = await context.newPage();
const browserErrors: string[] = [];
const outgoingOrigins = new Set<string>();
page.on("pageerror", (e) => browserErrors.push(e.name));
page.on("request", (r) => outgoingOrigins.add(new URL(r.url()).origin));
async function sessionToken(c: BrowserContext) {
  const cookies = (await c.cookies()).filter((c) =>
    c.name.startsWith("raes-web-auth"),
  );
  if (!cookies.length) return null;
  const raw = cookies
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((c) => c.value)
    .join("");
  const json = raw.startsWith("base64-")
    ? Buffer.from(raw.slice(7), "base64url").toString()
    : raw;
  return (JSON.parse(json) as { access_token: string }).access_token;
}
let userId: string | undefined;
let count = 0;
mkdirSync("/tmp/frontend-qa", { recursive: true });
try {
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ok(
    !created.error && created.data.user,
    "Could not create synthetic QA user",
  );
  userId = created.data.user.id;
  assert.equal((await fetch(`${api}/api/v1/admin/me`)).status, 401);
  assert.equal(
    (
      await fetch(`${api}/api/v1/admin/me`, {
        headers: { authorization: "Bearer invalid-fixture-token" },
      })
    ).status,
    401,
  );
  await page.goto(`${base}/institutions`);
  await page.waitForURL("**/login");
  await page.screenshot({
    path: "/tmp/frontend-qa/raes-login-desktop.png",
    fullPage: true,
  });
  // A valid Supabase account without an active admin profile must not enter RAES.
  await page.getByLabel("Correo institucional").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "No se pudo acceder" })
    .waitFor();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .waitFor();
  assert.ok(page.url().endsWith("/login"));
  const profile = await db.from("perfiles_admin").insert({
    id: userId,
    nombres: "Prueba",
    apellidos: "Frontend",
    rol: "AUDITOR",
    estado: "ACTIVO",
  });
  assert.ok(!profile.error, "Could not prepare synthetic AUDITOR profile");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Resumen del registro" }).waitFor();
  const token = await sessionToken(context);
  assert.ok(token, "HttpOnly session cookie required");
  const authHeaders = { authorization: `Bearer ${token}` };
  const me = await fetch(`${api}/api/v1/admin/me`, { headers: authHeaders });
  assert.equal(me.status, 200);
  const adminPayload: unknown = await me.json();
  assert.ok(isAdminProfile(adminPayload));
  assert.deepEqual(
    Object.keys(adminPayload.data).sort(),
    ["id", "nombres", "apellidos", "rol", "estado"].sort(),
  );
  assert.equal(adminPayload.data.rol, "AUDITOR");
  assert.equal(adminPayload.data.id, userId);
  assert.equal(me.headers.get("cache-control"), "private, no-store");
  for (const path of [
    "institutions",
    "api-clients",
    "institutions/00000000-0000-4000-8000-000000000000/integrations",
  ]) {
    // Authentication denies AUDITOR before body validation or any mutation.
    const denied = await fetch(`${api}/api/v1/admin/${path}`, {
      method: "POST",
      headers: authHeaders,
    });
    assert.equal(denied.status, 403);
  }
  const inactive = await db
    .from("perfiles_admin")
    .update({ estado: "INACTIVO" })
    .eq("id", userId);
  assert.ok(!inactive.error);
  assert.equal(
    (await fetch(`${api}/api/v1/admin/me`, { headers: authHeaders })).status,
    403,
  );
  for (const rol of ["ADMIN", "SUPERADMIN", "AUDITOR"]) {
    const updated = await db
      .from("perfiles_admin")
      .update({ rol, estado: "ACTIVO" })
      .eq("id", userId);
    assert.ok(!updated.error);
    const response = await fetch(`${api}/api/v1/admin/me`, {
      headers: authHeaders,
    });
    assert.equal(response.status, 200);
    const value: unknown = await response.json();
    assert.ok(isAdminProfile(value));
    assert.equal(value.data.rol, rol);
    await page.goto(`${base}/dashboard`);
    await page.getByText(rol, { exact: true }).waitFor();
    for (const path of ["institutions", "api-clients"]) {
      await page.goto(`${base}/${path}`);
      const visibleForms = await page.locator("summary").count();
      assert.equal(visibleForms, rol === "AUDITOR" ? 0 : 1);
    }
  }

  const response = await fetch(`${api}/api/v1/admin/institutions`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  const payload: unknown = await response.json();
  assert.ok(isInstitutions(payload));
  count = payload.data.length;
  const cookies = (await context.cookies()).filter((c) =>
    c.name.startsWith("raes-web-auth"),
  );
  assert.ok(
    cookies.length && cookies.every((c) => c.httpOnly && c.sameSite === "Lax"),
  );
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/dashboard`);
    await page.getByRole("heading", { name: "Resumen del registro" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `Dashboard overflows at ${width}`,
    );
    await page.screenshot({
      path: `/tmp/frontend-qa/raes-dashboard-${width}.png`,
      fullPage: true,
    });
    await page.goto(`${base}/institutions`);
    await page
      .getByRole("heading", { name: "Instituciones", exact: true })
      .waitFor();
    assert.equal(await page.locator("tbody tr").count(), count);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `Institutions overflow at ${width}`,
    );
    await page.screenshot({
      path: `/tmp/frontend-qa/raes-institutions-${width}.png`,
      fullPage: true,
    });
  }
  if (payload.data[0]) {
    await page
      .getByRole("link", {
        name: `Ver detalle de ${payload.data[0].nombre}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: payload.data[0].nombre, exact: true })
      .waitFor();
  }
  await page.goto(`${base}/institutions?q=NO_MATCH_SYNTHETIC_QA`);
  await page
    .getByRole("heading", { name: "Sin instituciones para mostrar" })
    .waitFor();
  await page.goto(`${base}/api-clients`);
  await page
    .getByRole("heading", { name: "Clientes API", exact: true })
    .waitFor();
  await page.goto(`${base}/audit`);
  await page
    .getByRole("heading", {
      name: "La consulta de auditoría aún no está disponible",
    })
    .waitFor();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForURL("**/login");
  await page.goto(`${base}/dashboard`);
  await page.waitForURL("**/login");
  await page.goto(`${base}/design-system`);
  await page
    .getByRole("heading", { name: "Una identidad, dos experiencias" })
    .waitFor();
  await page.screenshot({
    path: "/tmp/frontend-qa/design-system.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`${base}/login`);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/frontend-qa/raes-login-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(
    [...outgoingOrigins],
    [new URL(base).origin],
    "Browser must contact only its web origin",
  );
  assert.equal(
    browserErrors.length,
    0,
    "Client errors or hydration failures detected",
  );
} catch (error) {
  const diagnostics = {
    errorName: error instanceof Error ? error.name : "Unknown",
    pathname: new URL(page.url()).pathname,
    buttons: await page
      .getByRole("button")
      .allTextContents()
      .catch(() => []),
    alerts: await page
      .getByRole("alert")
      .allTextContents()
      .catch(() => []),
    browserErrorNames: browserErrors,
  };
  writeFileSync("/tmp/frontend-qa/failure.json", JSON.stringify(diagnostics), {
    mode: 0o600,
  });
  await page
    .screenshot({ path: "/tmp/frontend-qa/failure.png", fullPage: true })
    .catch(() => {});
  throw new Error(
    "Browser QA failed; sanitized diagnostics in /tmp/frontend-qa/failure.json",
  );
} finally {
  if (userId) {
    const token = await sessionToken(context);
    if (token) {
      const revoked = await db.auth.admin.signOut(token, "global");
      assert.ok(
        !revoked.error,
        `Stop: QA session cleanup failed for ${userId}`,
      );
    }
    await browser.close();
    const removed = await db.from("perfiles_admin").delete().eq("id", userId);
    assert.ok(!removed.error, `Stop: QA profile cleanup failed for ${userId}`);
    const deleted = await db.auth.admin.deleteUser(userId);
    assert.ok(!deleted.error, `Stop: QA auth cleanup failed for ${userId}`);
    const auth = await db.auth.admin.getUserById(userId);
    assert.ok(
      auth.error?.status === 404 && !auth.data.user,
      "QA Auth user remains",
    );
    const profile = await db
      .from("perfiles_admin")
      .select("id")
      .eq("id", userId);
    assert.ok(
      !profile.error && profile.data?.length === 0,
      "QA profile remains",
    );
  } else await browser.close();
}
console.log(
  JSON.stringify({
    realLogin: "OK",
    noAdminProfile: "DENIED",
    role: "AUDITOR",
    institutionRows: count,
    widths: [360, 768, 1024, 1440],
    source: "RAES_API",
    privateBrowserStorage: 0,
    browserDirectDatabaseRequests: 0,
    hydrationErrors: browserErrors.length,
    logoutGuard: "OK",
    temporaryUserId: userId,
    temporaryUserRemoved: true,
    academicMutations: 0,
  }),
);
