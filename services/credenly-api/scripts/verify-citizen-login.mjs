import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Operator verification only. Password/session stay in memory; no account,
// profile, verification, link, share or password mutations.
const args = process.argv.slice(2);
const option = (key) => {
  const n = args.indexOf(key);
  return n < 0 ? undefined : args[n + 1];
};
const email = option("--email"),
  expectedId = option("--expected-user-id");
const webBase = option("--web-base") ?? "http://localhost:3003";
const apiBase = option("--api-base") ?? "http://localhost:3002";
const output = option("--output");
assert.ok(
  process.stdin.isTTY && process.stdout.isTTY,
  "Run in an interactive terminal",
);
assert.ok(email && expectedId, "Provide --email and --expected-user-id");
for (const value of [webBase, apiBase])
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(value).hostname),
    "Local application origins only",
  );
const requireWeb = createRequire(
  new URL("../../../apps/credenly-web/package.json", import.meta.url),
);
const { createServerClient } = requireWeb("@supabase/ssr");
let password,
  browser,
  context,
  auth,
  passwordClient,
  phase = "password entry";
const result = { email, expectedId, accountMutations: 0 };
try {
  const hidden = new Writable({
    write(_chunk, _enc, done) {
      done();
    },
  });
  const terminal = createInterface({
    input: process.stdin,
    output: hidden,
    terminal: true,
  });
  terminal.on("SIGINT", () => terminal.close());
  process.stdout.write(
    `Verificar acceso ciudadano de ${email}. No cambia contraseña.\nContraseña ACTUAL (entrada oculta): `,
  );
  try {
    password = await terminal.question("");
  } finally {
    terminal.close();
    hidden.end();
    process.stdout.write("\n");
  }
  assert.ok(password && password.length <= 256, "Password input is required");
  phase = "password authentication";
  passwordClient = createClient(
    process.env.CREDENLY_WEB_SUPABASE_URL,
    process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const initial = await passwordClient.auth.signInWithPassword({
    email,
    password,
  });
  if (initial.error) {
    result.authError = {
      status: initial.error.status,
      code: initial.error.code,
    };
    throw new Error("Password sign-in failed");
  }
  assert.equal(initial.data.user.id, expectedId);
  assert.equal(initial.data.user.email, email);
  result.passwordAuthentication = "SUPABASE_REAL_LOGIN_OK";
  phase = "browser login";
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  context = await browser.newContext();
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(20000);
  const page = await context.newPage();
  let pageErrors = 0;
  page.on("pageerror", () => pageErrors++);
  await page.goto(`${webBase}/login`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  password = undefined;
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL(`${webBase}/credentials`);
  await page
    .getByRole("heading", { name: "Mis credenciales", exact: true })
    .waitFor();
  phase = "authoritative session";
  auth = createServerClient(
    process.env.CREDENLY_WEB_SUPABASE_URL,
    process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: "credenly-web-auth" },
      auth: { autoRefreshToken: false },
      cookies: {
        getAll: () =>
          context
            .cookies()
            .then((values) =>
              values.map(({ name, value }) => ({ name, value })),
            ),
        setAll() {},
      },
    },
  );
  const user = await auth.auth.getUser();
  assert.ok(!user.error);
  assert.equal(user.data.user.id, expectedId);
  assert.equal(user.data.user.email, email);
  const {
    data: { session },
  } = await auth.auth.getSession();
  assert.ok(session);
  result.login = "REAL_WEB_PASSWORD_LOGIN_OK";
  result.id = user.data.user.id;
  result.authConfirmedAt = user.data.user.email_confirmed_at;
  result.routes = {};
  let credentials = [];
  for (const route of [
    "auth/me",
    "profile",
    "identity-verifications",
    "raes/link",
    "credentials",
    "shares",
  ]) {
    phase = `HTTP ${route}`;
    const response = await fetch(`${apiBase}/api/v1/${route}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    result.routes[route] = { httpStatus: response.status };
    if (route === "credentials") {
      assert.equal(payload.source, "RAES");
      assert.equal(payload.persistedByCredenly, false);
      credentials = payload.data;
      result.credentials = payload.data.map((c) => ({
        id: c.id,
        code: c.codigoRaes,
        institutionId: c.institucion?.id,
      }));
      result.source = payload.source;
      result.persistedByCredenly = payload.persistedByCredenly;
    }
    if (route === "shares")
      result.shares = {
        count: payload.data.length,
        ids: payload.data.map((s) => s.id),
      };
  }
  for (const [route, heading] of [
    ["/onboarding", "Conecta tu historia académica"],
    ["/credentials", "Mis credenciales"],
    ["/shares", "Tus comparticiones"],
  ]) {
    phase = `web ${route}`;
    await page.goto(`${webBase}${route}`);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  assert.ok(credentials.length > 0, "Expected live academic credentials");
  phase = "web credential detail";
  await page.goto(
    `${webBase}/credentials/${encodeURIComponent(credentials[0].id)}`,
  );
  await page.locator("main h1").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  assert.equal(pageErrors, 0);
  result.webRoutes = [
    "/onboarding",
    "/credentials",
    "/shares",
    "/credentials/[id]",
  ];
  result.hydrationErrors = 0;
  phase = "logout";
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForURL(`${webBase}/login`);
  assert.ok(
    !(await context.cookies()).some((c) =>
      c.name.startsWith("credenly-web-auth"),
    ),
  );
  result.testSessionClosed = true;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = { phase, type: error?.name ?? "Error" };
  if (context) {
    try {
      const pages = context.pages();
      const p = pages[0];
      result.webFailure = {
        path: new URL(p.url()).pathname,
        alert: (await p.getByRole("alert").allTextContents()).map((text) =>
          text.slice(0, 200),
        ),
      };
    } catch {}
  }
  process.exitCode = 1;
  console.error(
    `Verificación detenida en: ${phase}. No se modificó contraseña ni cuenta. No se guardan diagnósticos de sesión.`,
  );
} finally {
  password = undefined;
  if (auth && !result.testSessionClosed) {
    try {
      const r = await auth.auth.signOut({ scope: "local" });
      result.testSessionClosed = !r.error;
    } catch {
      result.testSessionClosed = false;
    }
  }
  if (context && !auth) {
    try {
      auth = createServerClient(
        process.env.CREDENLY_WEB_SUPABASE_URL,
        process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
        {
          cookieOptions: { name: "credenly-web-auth" },
          auth: { autoRefreshToken: false },
          cookies: {
            getAll: () =>
              context
                .cookies()
                .then((values) =>
                  values.map(({ name, value }) => ({ name, value })),
                ),
            setAll() {},
          },
        },
      );
      const logout = await auth.auth.signOut({ scope: "local" });
      result.testSessionClosed = !logout.error;
    } catch {
      result.testSessionClosed = false;
    }
  }
  if (passwordClient) {
    try {
      const logout = await passwordClient.auth.signOut({ scope: "local" });
      result.passwordCheckSessionClosed = !logout.error;
    } catch {
      result.passwordCheckSessionClosed = false;
    }
  }
  if (browser) await browser.close();
  if (output)
    await writeFile(output, JSON.stringify(result, null, 2), { mode: 0o600 });
}
