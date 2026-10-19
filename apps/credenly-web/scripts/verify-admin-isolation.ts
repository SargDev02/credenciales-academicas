import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:https";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { chromium, expect } from "@playwright/test";

// Entirely local Auth/PostgREST/RAES fixtures. No .env or remote SDK client.
// Real built Credenly API + Web processes exercise the production code paths.
const root = resolve("../.."),
  base = "http://localhost:3313",
  apiBase = "http://localhost:3312";
const upstream = "https://localhost:3433",
  now = "2026-10-18T12:00:00Z";
const scratch = mkdtempSync(join(tmpdir(), "credenly-admin-local-"));
const key = join(scratch, "tls.key"),
  cert = join(scratch, "tls.crt");
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
  ],
  { stdio: "ignore" },
);
const password = randomBytes(32).toString("base64url"),
  signingKey = randomBytes(32);
const citizenId = "00000000-0000-4000-8000-000000000001",
  adminId = "00000000-0000-4000-8000-000000000002";
const users = [citizenId, adminId].map((id, n) => ({
  id,
  email: n ? "operator@fixture.invalid" : "admin@fixture.invalid",
  aud: "authenticated",
  role: "authenticated",
  created_at: now,
  email_confirmed_at: now,
  user_metadata: {
    rol: "ADMIN_CREDENLY",
    estado: "ACTIVO",
    internal: "LOCAL_PRIVATE_MARKER",
  },
  app_metadata: { provider: "email" },
}));
function jwt(id: string) {
  const data = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        iss: `${upstream}/auth/v1`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
  ].join(".");
  return `${data}.${createHmac("sha256", signingKey).update(data).digest("base64url")}`;
}
const sessions = new Map(users.map((u) => [jwt(u.id), u]));
const tokenFor = (id: string) =>
  [...sessions].find(([, user]) => user.id === id)![0];
let inactive = false,
  metricsError = false,
  raesDown = false;
let privateWrites = 0;
const audits: Record<string, unknown>[] = [];
const paths: string[] = [];
const fixture = createServer(
  { key: readFileSync(key), cert: readFileSync(cert) },
  async (req, res) => {
    const url = new URL(req.url!, upstream);
    paths.push(`${req.method} ${url.pathname}`);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const reply = (status: number, data: unknown) => {
      res.statusCode = status;
      res.end(status === 204 ? undefined : JSON.stringify(data));
    };
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const user = sessions.get(
      req.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    if (url.pathname === "/auth/v1/token") {
      const body = JSON.parse(raw);
      const account = users.find((u) => u.email === body.email);
      if (!account || body.password !== password)
        return reply(400, { msg: "Invalid credentials" });
      return reply(200, {
        access_token: tokenFor(account.id),
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: randomBytes(32).toString("base64url"),
        user: account,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return user
        ? reply(200, user)
        : reply(401, { msg: "invalid", code: "bad_jwt" });
    if (url.pathname === "/auth/v1/logout") return reply(204, null);
    if (url.pathname === "/auth/v1/admin/users")
      return reply(200, {
        users:
          url.searchParams.get("page") === "2"
            ? []
            : users.map((u) => ({
                ...u,
                encrypted_password: "LOCAL_PRIVATE_MARKER",
                last_sign_in_at: null,
              })),
        aud: "authenticated",
      });
    if (url.pathname === "/rest/v1/perfiles_admin")
      return reply(
        200,
        url.searchParams.get("id") === `eq.${adminId}`
          ? [
              {
                id: adminId,
                nombres: "Operador",
                apellidos: "Sintético",
                rol: "ADMIN_CREDENLY",
                estado: inactive ? "INACTIVO" : "ACTIVO",
              },
            ]
          : [],
      );
    if (url.pathname === "/rest/v1/auditoria_admin") {
      if (req.method === "POST") {
        audits.push({
          ...JSON.parse(raw),
          id: String(audits.length),
          created_at: now,
        });
        return reply(201, null);
      }
      return reply(
        200,
        audits.filter((a) => a.resultado === "ERROR").slice(-10),
      );
    }
    if (req.method === "HEAD") {
      if (metricsError) return reply(500, null);
      const total = url.pathname.endsWith("verificaciones_identidad")
        ? 5
        : url.pathname.endsWith("comparticiones")
          ? 3
          : 4;
      res.setHeader(
        "Content-Range",
        `*/${url.searchParams.has("estado") || url.searchParams.has("revoked_at") ? 1 : total}`,
      );
      return reply(200, null);
    }
    if (req.method !== "GET") {
      privateWrites++;
      return reply(500, { msg: "Unexpected fixture mutation" });
    }
    if (url.pathname === "/rest/v1/vinculaciones_raes")
      return reply(200, [
        {
          id: "00000000-0000-4000-8000-000000000003",
          usuario_id: citizenId,
          raes_persona_id: "00000000-0000-4000-8000-000000000004",
          verificacion_identidad_id: "00000000-0000-4000-8000-000000000005",
          estado: "VERIFICADA",
          metodo_verificacion: "OCR_DOCUMENTO",
          verified_at: now,
          created_at: now,
          updated_at: now,
        },
      ]);
    if (url.pathname === "/rest/v1/perfiles")
      return reply(200, [
        {
          id: citizenId,
          nombres: "Ciudadana",
          apellidos: "Sintética",
          estado: "ACTIVO",
          created_at: now,
          updated_at: now,
        },
      ]);
    if (url.pathname === "/api/v1/auth/client-whoami")
      return raesDown
        ? reply(503, { error: "RAES_UNAVAILABLE" })
        : reply(200, {
            data: {
              id: "local",
              clientId: "local",
              nombre: "local",
              tipoCliente: "CREDENLY",
              scopes: [],
            },
          });
    if (/\/api\/v1\/persons\/[^/]+\/credentials$/.test(url.pathname))
      return reply(200, { data: [] });
    reply(404, { msg: "Local fixture route missing" });
  },
);
fixture.listen(3433);
await once(fixture, "listening");
const inherited = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG"].flatMap((k) =>
    process.env[k] ? [[k, process.env[k]!]] : [],
  ),
);
const common = {
  ...inherited,
  NODE_ENV: "production",
  NODE_EXTRA_CA_CERTS: cert,
};
const api = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3312"],
  {
    cwd: join(root, "services/credenly-api"),
    env: {
      ...common,
      CREDENLY_SUPABASE_URL: upstream,
      CREDENLY_SUPABASE_SERVICE_ROLE_KEY:
        "fixture-service-key-only-in-local-test",
      RAES_API_BASE_URL: upstream,
      RAES_CREDENLY_CLIENT_ID: "local-fixture-client",
      RAES_CREDENLY_CLIENT_SECRET: "local-fixture-raes-secret-only",
    },
    stdio: "ignore",
  },
);
const web = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3313"],
  {
    env: {
      ...common,
      CREDENLY_WEB_SUPABASE_URL: upstream,
      CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
      CREDENLY_API_BASE_URL: apiBase,
      CREDENLY_WEB_SITE_URL: base,
    },
    stdio: "ignore",
  },
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext();
context.setDefaultTimeout(10000);
context.setDefaultNavigationTimeout(15000);
const page = await context.newPage();
const errors: string[] = [],
  origins = new Set<string>();
page.on("pageerror", (error) => errors.push(error.name));
page.on("request", (r) => origins.add(new URL(r.url()).origin));
let phase = "startup";
async function login(admin: boolean, account: number) {
  await page.goto(`${base}/${admin ? "admin/login" : "login"}`);
  await page
    .getByLabel(admin ? "Correo administrativo" : "Correo electrónico")
    .fill(users[account]!.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", {
      name: admin ? "Acceder a administración" : "Iniciar sesión",
      exact: true,
    })
    .click();
}
async function http(path: string, token?: string) {
  return fetch(`${apiBase}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
try {
  for (const url of [`${apiBase}/api/v1/health`, `${base}/login`]) {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, "Local Next server unavailable");
  }
  phase = "HTTP guards";
  assert.equal((await http("/api/v1/admin/me")).status, 401);
  assert.equal((await http("/api/v1/admin/me", "invalid-local")).status, 401);
  assert.equal(
    (await http("/api/v1/admin/me", tokenFor(citizenId))).status,
    403,
  );
  assert.equal((await http("/api/v1/admin/me", tokenFor(adminId))).status, 200);
  assert.equal(
    (await http("/api/v1/credentials", tokenFor(adminId))).status,
    403,
  );
  const normal = await http("/api/v1/credentials", tokenFor(citizenId));
  assert.equal(normal.status, 200);
  assert.deepEqual(await normal.json(), {
    data: [],
    source: "RAES",
    persistedByCredenly: false,
  });
  const accounts = await http("/api/v1/admin/users", tokenFor(adminId));
  assert.equal(accounts.status, 200);
  const accountText = await accounts.text();
  assert.ok(
    !accountText.includes("LOCAL_PRIVATE_MARKER") &&
      !accountText.includes("@fixture.invalid"),
  );
  phase = "citizen session";
  phase = "anonymous admin redirect";
  await page.goto(`${base}/admin`);
  await page.waitForURL("**/admin/login");
  await login(false, 0);
  phase = "citizen login redirect";
  await page.waitForURL("**/credentials");
  phase = "citizen empty credentials";
  await page
    .getByRole("heading", { name: "Aún no hay credenciales" })
    .waitFor();
  phase = "citizen admin denial";
  await login(true, 0);
  await page.getByText(/Una cuenta ciudadana no concede/).waitFor();
  assert.ok(
    (await context.cookies()).some((c) =>
      c.name.startsWith("credenly-web-auth"),
    ),
  );
  assert.ok(
    !(await context.cookies()).some((c) =>
      c.name.startsWith("credenly-admin-web-auth"),
    ),
  );
  phase = "admin session";
  await login(true, 1);
  await page.waitForURL(`${base}/admin`);
  await page.getByRole("heading", { name: "Resumen operativo" }).waitFor();
  const cookies = await context.cookies();
  for (const prefix of ["credenly-web-auth", "credenly-admin-web-auth"])
    assert.ok(
      cookies
        .filter((c) => c.name.startsWith(prefix))
        .every((c) => c.httpOnly && c.sameSite === "Lax"),
    );
  mkdirSync("/tmp/credenly-admin-qa", { recursive: true });
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/verifications",
    "/admin/links",
    "/admin/shares",
    "/admin/health",
  ]) {
    phase = `responsive ${path}`;
    await page.goto(`${base}${path}`);
    await page.locator("main h1").waitFor();
    await expect(page.locator(".operations-header")).toHaveCount(1);
    await expect(page.locator("aside nav ul")).toHaveCSS("display", "grid");
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow at ${width}`,
      );
      if (path === "/admin" || path === "/admin/users")
        await page.screenshot({
          path: `/tmp/credenly-admin-qa/${path.slice(1).replaceAll("/", "-")}-${width}.png`,
          fullPage: true,
        });
    }
    assert.ok(
      !(await page.locator("body").textContent())!.includes(
        "LOCAL_PRIVATE_MARKER",
      ),
    );
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
  }
  phase = "pagination and errors";
  await page.goto(`${base}/admin/users?page=2`);
  await page
    .getByRole("heading", { name: "Sin cuentas en esta página" })
    .waitFor();
  await page.goto(`${base}/admin/users?page=-1`);
  await page.getByText("Página no válida", { exact: true }).waitFor();
  raesDown = true;
  await page.goto(`${base}/admin/health`);
  await page
    .getByText("Servicio con dependencias no disponibles", { exact: true })
    .waitFor();
  raesDown = false;
  metricsError = true;
  await page.goto(`${base}/admin`);
  await page
    .getByText("No pudimos completar la consulta operativa", { exact: true })
    .waitFor();
  metricsError = false;
  phase = "logout isolation";
  await page.goto(`${base}/admin`);
  await page.getByRole("button", { name: "Salir de administración" }).click();
  await page.waitForURL("**/admin/login");
  assert.ok(
    !(await context.cookies()).some((c) =>
      c.name.startsWith("credenly-admin-web-auth"),
    ),
  );
  await page.goto(`${base}/credentials`);
  await page.getByRole("heading", { name: "Mis credenciales" }).waitFor();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForURL("**/login");
  phase = "admin never inherits citizenship";
  await login(true, 1);
  await page.waitForURL(`${base}/admin`);
  await page.goto(`${base}/credentials`);
  await page.waitForURL("**/login");
  await login(false, 1);
  await page.getByText(/Si tu cuenta es administrativa/).waitFor();
  assert.ok(
    (await context.cookies()).some((c) =>
      c.name.startsWith("credenly-admin-web-auth"),
    ),
  );
  inactive = true;
  assert.equal((await http("/api/v1/admin/me", tokenFor(adminId))).status, 403);
  await page.goto(`${base}/admin`);
  await page
    .getByText("No pudimos abrir la administración", { exact: true })
    .waitFor();
  assert.equal(privateWrites, 0);
  assert.ok(audits.some((a) => a.resultado === "ERROR"));
  for (const row of audits)
    assert.deepEqual(
      Object.keys(row).sort(),
      [
        "actor_id",
        "accion",
        "resultado",
        "recurso_tipo",
        "recurso_id",
        "id",
        "created_at",
      ].sort(),
    );
  assert.deepEqual(errors, []);
  assert.deepEqual([...origins], [base]);
  console.log(
    JSON.stringify({
      upstreams: "LOCAL_FIXTURES_ONLY",
      applications: "BUILT_API_AND_WEB",
      adminStatuses: [401, 403, 200],
      citizenRegression: "HTTP_200_RAES_AND_BROWSER_OK",
      separateCookieNamespaces: true,
      citizenSessionSurvivesAdminLogout: true,
      adminCitizenAccess: 403,
      administrativeAudit: "MINIMAL_SUCCESS_AND_ERROR",
      remoteAuthMutations: 0,
      privateOrAcademicWrites: privateWrites,
      widths: [360, 768, 1024, 1440],
      routes: 6,
      hydrationErrors: errors.length,
      browserOrigins: "WEB_ONLY",
    }),
  );
} catch (error) {
  // Never serialize Playwright diagnostics, cookies, credentials or token URLs.
  console.error(
    JSON.stringify({
      phase,
      path: new URL(page.url()).pathname,
      upstreamRequests: paths.slice(-20),
    }),
  );
  throw new Error(
    `Local admin isolation QA failed in ${phase}: ${error instanceof Error ? error.name : "Unknown"}; no session diagnostics saved`,
  );
} finally {
  await browser.close();
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  rmSync(scratch, { recursive: true, force: true });
}
