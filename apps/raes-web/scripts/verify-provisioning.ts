import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import { guardFixtureRequest } from "../../../tests/helpers/http-fixture";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Local API fixture only: creation must never mutate remote institutions/clients.
// Auth is real and temporary. No screenshots/traces/logging of the secret result.
assert.ok(process.argv.includes("--temporary-admin"));
const base = "http://localhost:3204";
const db = createClient(
  process.env.RAES_SUPABASE_URL!,
  process.env.RAES_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
assert.equal(
  new URL(process.env.RAES_SUPABASE_URL!).hostname,
  "xldjndaunxziiymvwsji.supabase.co",
);
const email = `synthetic-frontend-${randomUUID()}@example.invalid`;
const password = randomBytes(32).toString("base64url");
const secret = randomBytes(32).toString("base64url");
const institutionId = randomUUID();
const now = "2026-10-18T12:00:00Z";
const institution = {
  id: institutionId,
  nit: "SYNTH-LOCAL-ONLY",
  nombre: "Institución sintética de QA local",
  codigoSnies: null,
  tipoInstitucion: "Prueba",
  estado: "ACTIVA",
  createdAt: now,
  updatedAt: now,
};
let role = "AUDITOR";
let posts = 0;
let nextStatus = 201;
let userId: string | undefined;
let session: string | undefined;
const api = createServer(guardFixtureRequest(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status: number, body: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (!session || req.headers.authorization !== `Bearer ${session}`)
    return reply(401, { error: "SESSION_INVALID" });
  if (req.method === "GET") {
    if (req.url === "/api/v1/admin/me")
      return reply(200, {
        data: {
          id: userId,
          nombres: "QA",
          apellidos: "Sintética local",
          rol: role,
          estado: "ACTIVO",
        },
      });
    if (req.url === "/api/v1/admin/institutions")
      return reply(200, { data: [institution] });
    if (req.url === "/api/v1/admin/api-clients")
      return reply(200, { data: [] });
  }
  if (req.method === "POST") {
    posts++;
    if (role === "AUDITOR") return reply(403, { error: "INSUFFICIENT_ROLE" });
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (nextStatus !== 201) {
      const status = nextStatus;
      nextStatus = 201;
      return reply(status, { message: "private backend error fixture" });
    }
    if (req.url === "/api/v1/admin/institutions") {
      assert.ok(body.nombre && body.nit && body.tipoInstitucion);
      return reply(201, {
        data: { ...institution, nombre: body.nombre, id: randomUUID() },
      });
    }
    if (
      req.url === "/api/v1/admin/api-clients" ||
      req.url === `/api/v1/admin/institutions/${institutionId}/integrations`
    ) {
      const isClient = req.url.endsWith("api-clients");
      return reply(201, {
        data: {
          [isClient ? "client" : "integration"]: { id: randomUUID() },
          scopes: body.scopes ?? ["institution:sync"],
          credentials: {
            clientId: "raes_cli_local_qa",
            clientSecret: secret,
            authorization: "never-forward-this-extra-field",
          },
        },
      });
    }
  }
  reply(404, { error: "LOCAL_FIXTURE_NOT_FOUND" });
}));
api.listen(3401, "127.0.0.1");
await once(api, "listening");
// Explicit environment allowlist: operator service-role key is never inherited by Next.
const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
for (const key of [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "RAES_WEB_SUPABASE_URL",
  "RAES_WEB_SUPABASE_PUBLISHABLE_KEY",
])
  if (process.env[key]) env[key] = process.env[key]!;
env.RAES_API_BASE_URL = "http://127.0.0.1:3401";
const web = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3204"],
  { env, stdio: "ignore" },
);
const browser = await chromium.launch(chromiumLaunchOptions);
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
const origins = new Set<string>();
page.on("pageerror", (e) => errors.push(e.name));
page.on("request", (r) => origins.add(new URL(r.url()).origin));
try {
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(`${base}/design-system`)).ok) break;
    } catch { /* Expected transient failure or optional diagnostic; no sensitive error output. */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ok(
    !created.error && created.data.user,
    "Temporary Auth creation failed",
  );
  userId = created.data.user.id;
  const signedIn = await db.auth.signInWithPassword({ email, password });
  assert.ok(!signedIn.error && signedIn.data.session);
  session = signedIn.data.session.access_token;
  // Login in browser creates a distinct session. Fixture accepts its JWT after
  // authoritative getUser in the app. Capture it through server request at login.
  const originalListeners = api.listeners("request");
  api.removeAllListeners("request");
  api.on("request", guardFixtureRequest(async (req, res) => {
    if (
      req.url === "/api/v1/admin/me" &&
      req.headers.authorization !== `Bearer ${session}`
    ) {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (token) {
        const result = await db.auth.getUser(token);
        if (result.data.user?.id === userId) session = token;
      }
    }
    for (const listener of originalListeners) listener.call(api, req, res);
  }));
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo institucional").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  for (const path of [
    "institutions",
    "api-clients",
    `institutions/${institutionId}`,
  ]) {
    await page.goto(`${base}/${path}`);
    assert.equal(
      await page.locator("summary").count(),
      0,
      "AUDITOR must not see creation actions",
    );
  }
  role = "ADMIN";
  await page.goto(`${base}/institutions`);
  await page.locator("summary").click();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Institución sintética local");
  await page.getByLabel("NIT", { exact: true }).fill("SYNTH-QA-LOCAL");
  await page.getByLabel("Tipo de institución").fill("Prueba");
  nextStatus = 409;
  await page
    .getByRole("button", { name: "Crear institución", exact: true })
    .click();
  await page
    .getByText("La operación entra en conflicto con un registro existente.")
    .waitFor();
  await page
    .getByRole("button", { name: "Crear institución", exact: true })
    .click();
  await page.getByText("Registro creado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Cerrar resultado" }).click();
  await page.goto(`${base}/api-clients`);
  await page.locator("summary").click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Cliente sintético local");
  await page.getByLabel("Tipo de cliente").selectOption("OTRO");
  await page
    .getByLabel("Permisos solicitados", { exact: true })
    .fill("credentials:read");
  await page
    .getByRole("button", { name: "Crear cliente API", exact: true })
    .click();
  await page.getByLabel("Clave secreta", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Clave secreta", { exact: true }).inputValue(),
    secret,
  );
  assert.equal(
    (await page.locator("body").textContent())!.includes(
      "never-forward-this-extra-field",
    ),
    false,
  );
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await page.getByRole("button", { name: "Cerrar resultado" }).click();
  assert.equal(
    await page.getByLabel("Clave secreta", { exact: true }).count(),
    0,
  );
  await page.reload();
  assert.equal(
    await page.getByLabel("Clave secreta", { exact: true }).count(),
    0,
  );
  await page.goto(`${base}/institutions/${institutionId}`);
  await page.locator("summary").click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Integración sintética local");
  await page
    .getByRole("button", { name: "Crear integración", exact: true })
    .click();
  await page.getByLabel("Clave secreta", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Clave secreta", { exact: true }).inputValue(),
    secret,
  );
  await page
    .getByText("Permisos confirmados por RAES: institution:sync")
    .waitFor();
  await page.getByRole("button", { name: "Cerrar resultado" }).click();
  role = "SUPERADMIN";
  await page.goto(`${base}/api-clients`);
  await page.locator("summary").click();
  await page.getByLabel("Nombre", { exact: true }).fill("No debe crearse");
  await page.getByLabel("Tipo de cliente").selectOption("OTRO");
  await page
    .getByLabel("Permisos solicitados", { exact: true })
    .fill("credentials:read");
  role = "AUDITOR";
  const before = posts;
  await page
    .getByRole("button", { name: "Crear cliente API", exact: true })
    .click();
  await page.getByText("Tu rol permite únicamente consultas.").waitFor();
  assert.equal(posts, before, "Changed role must be rechecked before POST");
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  assert.deepEqual([...origins], [base]);
  assert.deepEqual(errors, []);
  assert.equal(posts, 4);
} catch (error) {
  throw new Error(
    `Provisioning browser QA failed (${error instanceof Error ? error.name : "Unknown"}), pathname=${new URL(page.url()).pathname}; no secret diagnostics recorded`,
  );
} finally {
  if (userId) {
    if (session) {
      const revoked = await db.auth.admin.signOut(session, "global");
      assert.ok(!revoked.error, "Stop: session cleanup failed");
    }
    const deleted = await db.auth.admin.deleteUser(userId);
    assert.ok(!deleted.error, "Stop: Auth cleanup failed");
    const check = await db.auth.admin.getUserById(userId);
    assert.equal(check.error?.status, 404);
  }
  await browser.close();
  web.kill("SIGTERM");
  api.close();
}
console.log(
  JSON.stringify({
    provisioning: "LOCAL_API_FIXTURE_OK",
    roles: ["AUDITOR", "ADMIN", "SUPERADMIN"],
    createdInstitutionsRemote: 0,
    createdClientsRemote: 0,
    createdIntegrationsRemote: 0,
    temporaryAuthRemoved: true,
    temporaryUserId: userId,
    privateBrowserStorage: 0,
    secretNotRecoverableAfterDismissOrReload: true,
    staleRoleGuard: "OK",
    hydrationErrors: 0,
  }),
);
