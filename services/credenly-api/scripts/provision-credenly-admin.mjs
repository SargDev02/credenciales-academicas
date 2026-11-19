import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import {
  ProvisionError,
  assertEmailAvailable,
  listAuthUsers,
  provisionAdmin,
  validatePassword,
} from "./lib/admin-provisioning.mjs";

// Explicit operator invocation only. No product runtime or background job imports.
// Passwords, sessions and private rows never enter evidence, files or diagnostics.
const args = process.argv.slice(2),
  values = {};
const allowed = new Set([
  "--email",
  "--nombres",
  "--apellidos",
  "--protect-evidence",
  "--output",
  "--api-base",
  "--web-base",
]);
let checkOnly = false,
  password,
  confirmation,
  db,
  passwordClient,
  browser,
  context,
  webAuth;
let phase = "arguments",
  profile,
  protectedBaseline;
const evidence = {
  startedAt: new Date().toISOString(),
  status: "NOT_STARTED",
  sessionCleanup: {},
};
const hash = (data) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
function requireSafe(condition, message) {
  if (!condition) throw new ProvisionError(message);
}
function authProjection(user) {
  return {
    id: user.id,
    email: user.email,
    emailConfirmedAt: user.email_confirmed_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}
async function persist() {
  if (values["--output"])
    await writeFile(
      values["--output"],
      JSON.stringify(evidence, null, 2) + "\n",
      { mode: 0o600 },
    );
}
async function rows(table) {
  const all = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const result = await db
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    requireSafe(
      !result.error && Array.isArray(result.data),
      "No se pudo leer la evidencia de conservación.",
    );
    all.push(...result.data);
    if (result.data.length < 1000) return all;
  }
  throw new ProvisionError(
    "Inventario incompleto; revisar límites antes de continuar.",
  );
}
async function citizenSnapshot() {
  const tables = {},
    id = protectedBaseline.auth.id;
  const account = await db.auth.admin.getUserById(id);
  requireSafe(
    !account.error && account.data.user?.email === protectedBaseline.auth.email,
    "La cuenta ciudadana protegida cambió. Detenido.",
  );
  for (const table of [
    "perfiles",
    "verificaciones_identidad",
    "vinculaciones_raes",
    "comparticiones",
    "accesos_compartidos",
  ]) {
    const all = await rows(table);
    const own = all.filter((row) =>
      table === "perfiles"
        ? row.id === id
        : table === "accesos_compartidos"
          ? protectedBaseline.tables.comparticiones.ids.includes(
              row.comparticion_id,
            )
          : row.usuario_id === id,
    );
    tables[table] = {
      count: own.length,
      ids: own.map((row) => row.id),
      sha256: hash(own),
      allRowsCount: all.length,
      allRowsSha256: hash(all),
    };
    const expected = protectedBaseline.tables[table];
    for (const key of ["count", "sha256", "allRowsCount", "allRowsSha256"])
      requireSafe(
        tables[table][key] === expected[key],
        "Los datos ciudadanos difieren de la evidencia previa. Detenido sin modificarlos.",
      );
    requireSafe(
      JSON.stringify(tables[table].ids) === JSON.stringify(expected.ids),
      "Cambiaron IDs ciudadanos. Detenido.",
    );
  }
  return { auth: authProjection(account.data.user), tables };
}
async function noCitizenRelations(id) {
  for (const table of [
    "perfiles",
    "verificaciones_identidad",
    "vinculaciones_raes",
    "comparticiones",
  ]) {
    const r = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(table === "perfiles" ? "id" : "usuario_id", id);
    requireSafe(
      !r.error && r.count === 0,
      "Se encontró una relación ciudadana inesperada para el UUID nuevo. Detenido.",
    );
  }
  // Without shares owned by this UUID there can be no associated shared accesses.
}
async function precheck() {
  const accounts = await listAuthUsers(db.auth.admin);
  assertEmailAvailable(accounts, values["--email"]);
  const adminProfiles = await rows("perfiles_admin"),
    audit = await rows("auditoria_admin");
  const citizen = await citizenSnapshot();
  requireSafe(
    !adminProfiles.some((p) => p.id === citizen.auth.id),
    "La identidad protegida tiene un perfil administrativo inesperado.",
  );
  return {
    accounts,
    citizen,
    adminTables: {
      perfiles_admin: adminProfiles.length,
      auditoria_admin: audit.length,
    },
    audit,
  };
}
async function hiddenPassword() {
  requireSafe(
    process.stdin.isTTY && process.stdout.isTTY,
    "Usa Terminal interactiva. No se aceptan contraseñas por argumentos, archivos o pipes.",
  );
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const terminal = createInterface({
    input: process.stdin,
    output: silent,
    terminal: true,
  });
  terminal.on("SIGINT", () => terminal.close());
  try {
    process.stdout.write(
      `Crear administrador sintético ${values["--email"]}.\nNueva contraseña (12–256 caracteres; entrada oculta): `,
    );
    password = await terminal.question("");
    process.stdout.write("\nRepite la contraseña (entrada oculta): ");
    confirmation = await terminal.question("");
    process.stdout.write("\n");
  } finally {
    terminal.close();
    silent.end();
  }
  validatePassword(password, confirmation);
  confirmation = undefined;
}
async function http(path, token) {
  const response = await fetch(`${values["--api-base"]}/api/v1/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  let body;
  try {
    body = await response.json();
  } catch { /* Expected transient failure or optional diagnostic; no sensitive error output. */ }
  return { status: response.status, body };
}
function browserAuth(createServerClient) {
  return createServerClient(
    process.env.CREDENLY_WEB_SUPABASE_URL,
    process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: "credenly-admin-web-auth" },
      auth: { autoRefreshToken: false },
      cookies: {
        getAll: async () =>
          (await context.cookies()).map(({ name, value }) => ({ name, value })),
        setAll() {},
      },
    },
  );
}
async function verifyWeb() {
  const { chromium } = await import("@playwright/test");
  const requireWeb = createRequire(
    new URL("../../../apps/credenly-web/package.json", import.meta.url),
  );
  const { createServerClient } = requireWeb("@supabase/ssr");
  browser = await chromium.launch(chromiumLaunchOptions);
  context = await browser.newContext();
  context.setDefaultTimeout(20000);
  context.setDefaultNavigationTimeout(30000);
  // No trace, video, screenshots, HAR, storageState or URL/error logging.
  const page = await context.newPage(),
    origins = new Set();
  let errors = 0;
  page.on("pageerror", () => errors++);
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto(`${values["--web-base"]}/admin/login`);
  await page.getByLabel("Correo", { exact: true }).fill(values["--email"]);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  password = undefined;
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL(`${values["--web-base"]}/admin`);
  webAuth = browserAuth(createServerClient);
  const who = await webAuth.auth.getUser();
  requireSafe(
    !who.error && who.data.user?.id === profile.id,
    "La sesión web no corresponde al UUID administrativo creado.",
  );
  const cookies = await context.cookies();
  requireSafe(
    cookies.some(
      (c) => c.name.startsWith("credenly-admin-web-auth") && c.httpOnly,
    ),
    "No se confirmó cookie administrativa HttpOnly.",
  );
  requireSafe(
    !cookies.some((c) => c.name.startsWith("credenly-web-auth")),
    "Se detectó una cookie ciudadana inesperada.",
  );
  evidence.web = {
    origin: values["--web-base"],
    realPasswordLogin: true,
    id: who.data.user.id,
    administrativeCookiesHttpOnly: true,
    citizenCookiePresent: false,
    routes: [],
  };
  for (const [path, heading] of [
    ["/admin", "Resumen operativo"],
    ["/admin/users", "Cuentas y perfiles"],
    ["/admin/verifications", "Verificación documental"],
    ["/admin/links", "Vinculaciones RAES"],
    ["/admin/shares", "Comparticiones"],
    ["/admin/health", "Salud del servicio"],
  ]) {
    phase = `web ${path}`;
    await page.goto(`${values["--web-base"]}${path}`);
    await page.locator("main h1").filter({ hasText: heading }).waitFor();
    await page
      .locator(".operations-account-name")
      .filter({ hasText: `${profile.nombres} ${profile.apellidos}` })
      .waitFor();
    await page
      .locator(".operations-account-role")
      .filter({ hasText: "ADMIN_CREDENLY" })
      .waitFor();
    if (path === "/admin") {
      const metrics = page.locator(".operations-stats .ui-metric-value");
      requireSafe(
        (await metrics.count()) === 4,
        "No se mostraron los cuatro indicadores reales.",
      );
      for (const [i, key] of [
        "profiles",
        "verifications",
        "links",
        "shares",
      ].entries())
        requireSafe(
          (await metrics.nth(i).textContent()) ===
            evidence.overviewTotals[key].toLocaleString("es-CO"),
          "Un indicador web difiere de la consulta real.",
        );
      evidence.web.dashboardMatchesRealOverview = true;
    }
    requireSafe(
      (await page.evaluate(
        () => localStorage.length + sessionStorage.length,
      )) === 0,
      "Se detectó almacenamiento de sesión inesperado.",
    );
    evidence.web.routes.push(path);
  }
  // Exercise a real navigation link, not only direct route loads.
  await page
    .getByRole("navigation", {
      name: "Administración de Credenly",
      exact: true,
    })
    .getByRole("link", { name: "Resumen", exact: false })
    .click();
  await page
    .getByRole("heading", { name: "Resumen operativo", exact: true })
    .waitFor();
  requireSafe(errors === 0, "Se detectaron errores en el navegador.");
  requireSafe(
    [...origins].every((origin) => origin === values["--web-base"]),
    "El browser contactó un origen inesperado.",
  );
  evidence.web.hydrationErrors = 0;
  evidence.web.manualSessionStorage = false;
  phase = "web logout";
  await page
    .getByRole("button", { name: "Salir de administración", exact: true })
    .click();
  await page.waitForURL(`${values["--web-base"]}/admin/login`);
  requireSafe(
    !(await context.cookies()).some((c) =>
      c.name.startsWith("credenly-admin-web-auth"),
    ),
    "Quedó una cookie administrativa después del logout.",
  );
  evidence.sessionCleanup.webLogout = true;
}
async function main() {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check" && !checkOnly) {
      checkOnly = true;
      continue;
    }
    requireSafe(
      allowed.has(args[i]) &&
        values[args[i]] === undefined &&
        args[i + 1] &&
        !args[i + 1].startsWith("--"),
      "Argumentos no válidos; no se admite contraseña por CLI.",
    );
    values[args[i]] = args[++i];
  }
  requireSafe(
    /^\S+@\S+\.\S+$/.test(values["--email"] ?? "") &&
      ["--nombres", "--apellidos"].every(
        (key) => values[key]?.trim() && values[key].length <= 160,
      ) &&
      values["--protect-evidence"],
    "Indica --email, --nombres, --apellidos y --protect-evidence.",
  );
  values["--email"] = values["--email"].toLowerCase();
  values["--api-base"] ??= "http://localhost:3002";
  values["--web-base"] ??= "http://localhost:3003";
  for (const key of ["--api-base", "--web-base"]) {
    const url = new URL(values[key]);
    requireSafe(
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.origin === values[key],
      "Las aplicaciones deben ser orígenes locales sin credenciales.",
    );
  }
  const url = process.env.CREDENLY_SUPABASE_URL,
    key = process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY;
  requireSafe(
    url && key && new URL(url).protocol === "https:",
    "Carga el env de servidor Credenly.",
  );
  requireSafe(
    process.env.CREDENLY_WEB_SUPABASE_URL === url &&
      process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
    "Web y API deben apuntar al mismo proyecto Credenly.",
  );
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init = {}) =>
        fetch(input, {
          ...init,
          signal: init.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
            : AbortSignal.timeout(20000),
        }),
    },
  };
  db = createClient(url, key, options);
  const previous = JSON.parse(
    await readFile(values["--protect-evidence"], "utf8"),
  );
  protectedBaseline = previous.after;
  requireSafe(
    protectedBaseline?.auth?.id &&
      protectedBaseline.auth.email !== values["--email"] &&
      protectedBaseline.tables,
    "Evidencia ciudadana protegida no válida.",
  );
  phase = "precheck";
  const before = await precheck();
  evidence.email = values["--email"];
  evidence.before = {
    authCount: before.accounts.length,
    adminEmailMatches: 0,
    administrativeTables: before.adminTables,
    citizen: before.citizen,
  };
  evidence.status = "PRECHECK_OK";
  await persist();
  console.log(
    "Precheck correcto: correo libre, tablas administrativas presentes y evidencia ciudadana idéntica.",
  );
  if (checkOnly) {
    console.log("Modo solo lectura; no se creó ninguna cuenta.");
    return;
  }
  // Check services before asking the user for the password or mutating Auth.
  for (const path of [
    `${values["--web-base"]}/admin/login`,
    `${values["--api-base"]}/api/v1/admin/me`,
  ]) {
    const r = await fetch(path, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    requireSafe(
      [200, 401].includes(r.status),
      "Las aplicaciones locales no están disponibles para validar.",
    );
  }
  phase = "password entry";
  await hiddenPassword();
  phase = "precreation recheck";
  const current = await precheck();
  requireSafe(
    hash(current.citizen) === hash(before.citizen),
    "La identidad protegida cambió mientras se esperaba. Sin creación.",
  );
  phase = "provision";
  profile = await provisionAdmin({
    auth: db.auth.admin,
    email: values["--email"],
    nombres: values["--nombres"],
    apellidos: values["--apellidos"],
    password,
    previousIds: new Set(current.accounts.map((u) => u.id)),
    profiles: {
      assertNoCitizenRelations: noCitizenRelations,
      async find(id) {
        const r = await db
          .from("perfiles_admin")
          .select("id,nombres,apellidos,rol,estado")
          .eq("id", id)
          .maybeSingle();
        requireSafe(!r.error, "No se pudo comprobar el perfil administrativo.");
        return r.data;
      },
      async insert(value) {
        const r = await db.from("perfiles_admin").insert(value);
        requireSafe(!r.error, "No se pudo crear el perfil administrativo.");
      },
    },
  });
  evidence.created = {
    ...profile,
    email: values["--email"],
    method: "SUPABASE_AUTH_ADMIN_CREATE_USER",
    emailConfirm: true,
    confirmationMeaning: "OPERATOR_PROVISIONING_NOT_MAILBOX_CONTROL",
  };
  await persist();
  console.log(
    `Administrador creado con UUID nuevo: ${profile.id}. Validando sesión y aislamiento.`,
  );
  phase = "real Auth login";
  passwordClient = createClient(
    url,
    process.env.CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
    options,
  );
  const login = await passwordClient.auth.signInWithPassword({
    email: values["--email"],
    password,
  });
  requireSafe(
    !login.error && login.data.user?.id === profile.id && login.data.session,
    "Cuenta creada; falló login Auth. No repetir aprovisionamiento.",
  );
  evidence.authLogin = {
    successful: true,
    id: login.data.user.id,
    emailConfirmed: !!login.data.user.email_confirmed_at,
  };
  const token = login.data.session.access_token;
  evidence.administrativeHttp = {};
  for (const path of [
    "admin/me",
    "admin/overview",
    "admin/users",
    "admin/health",
  ]) {
    phase = `HTTP ${path}`;
    const r = await http(path, token);
    requireSafe(
      r.status === 200 && r.body?.data,
      "Cuenta creada; falló validación administrativa HTTP.",
    );
    evidence.administrativeHttp[path] = { status: r.status };
    if (path === "admin/me") assert.deepEqual(r.body.data, profile);
    if (path === "admin/overview")
      evidence.overviewTotals = Object.fromEntries(
        ["profiles", "verifications", "links", "shares"].map((key) => [
          key,
          r.body.data[key].total,
        ]),
      );
    if (path === "admin/health") {
      requireSafe(
        [200, 503].includes(r.body.data.httpStatus),
        "Readiness no válido.",
      );
      evidence.administrativeHttp[path].readiness = r.body.data;
    }
  }
  phase = "citizen isolation";
  const citizensBefore = await citizenSnapshot(),
    auditBefore = hash(await rows("auditoria_admin"));
  evidence.citizenHttp = {};
  for (const path of [
    "auth/me",
    "profile",
    "identity-verifications",
    "raes/link",
    "credentials",
    "shares",
  ]) {
    const r = await http(path, token);
    requireSafe(
      r.status === 403,
      "El UUID administrativo obtuvo acceso ciudadano inesperado. Detenido.",
    );
    evidence.citizenHttp[path] = { status: r.status };
  }
  requireSafe(
    hash(await citizenSnapshot()) === hash(citizensBefore) &&
      hash(await rows("auditoria_admin")) === auditBefore,
    "Las denegaciones ciudadanas generaron cambios inesperados.",
  );
  await noCitizenRelations(profile.id);
  evidence.blockedCallsWrites = 0;
  phase = "web login";
  await verifyWeb();
  phase = "conservation";
  const after = await citizenSnapshot();
  requireSafe(
    hash(after) === hash(before.citizen),
    "La evidencia ciudadana cambió al finalizar. Revisar antes de actuar.",
  );
  const finalAccounts = await listAuthUsers(db.auth.admin);
  for (const account of before.accounts)
    requireSafe(
      hash(
        authProjection(finalAccounts.find((u) => u.id === account.id) ?? {}),
      ) === hash(authProjection(account)),
      "Cambió una cuenta Auth preexistente. Detenido.",
    );
  requireSafe(
    finalAccounts.length === before.accounts.length + 1 &&
      finalAccounts.filter((u) => u.email?.toLowerCase() === values["--email"])
        .length === 1,
    "Inventario final Auth inesperado.",
  );
  const adminProfiles = await rows("perfiles_admin"),
    citizens = await rows("perfiles");
  requireSafe(
    !adminProfiles.some((a) => citizens.some((c) => c.id === a.id)),
    "Se encontró UUID con ambos perfiles. Detenido.",
  );
  const audits = (await rows("auditoria_admin")).filter(
    (a) => a.actor_id === profile.id,
  );
  requireSafe(
    [
      "ADMIN_PROFILE_READ",
      "OPERATIONS_READ",
      "AUTH_ACCOUNTS_READ",
      "HEALTH_READ",
    ].every((action) =>
      audits.some((a) => a.accion === action && a.resultado === "EXITO"),
    ),
    "Falta auditoría administrativa real.",
  );
  requireSafe(
    audits.every((a) =>
      Object.keys(a).every((key) =>
        [
          "id",
          "actor_id",
          "accion",
          "resultado",
          "recurso_tipo",
          "recurso_id",
          "created_at",
        ].includes(key),
      ),
    ),
    "Auditoría con campos inesperados.",
  );
  evidence.after = {
    authCount: finalAccounts.length,
    citizen: after,
    protectedCitizenUnchanged: true,
    existingAuthAccountsUnchanged: true,
    noOverlappingProfiles: true,
    administratorCitizenRelations: 0,
  };
  evidence.audit = {
    actorId: profile.id,
    count: audits.length,
    byAction: Object.fromEntries(
      [
        "ADMIN_PROFILE_READ",
        "OPERATIONS_READ",
        "AUTH_ACCOUNTS_READ",
        "HEALTH_READ",
      ].map((action) => [
        action,
        audits.filter((a) => a.accion === action).length,
      ]),
    ),
    ids: audits.map((a) => a.id),
    minimalFieldsOnly: true,
  };
  evidence.status = "VALIDATED";
}
try {
  await main();
} catch (error) {
  evidence.status = "STOPPED";
  evidence.failure = {
    phase,
    type: error?.name ?? "Error",
    ...(error instanceof ProvisionError ? error.details : {}),
  };
  console.error(
    error instanceof ProvisionError
      ? error.message
      : `Operación detenida en ${phase}. Diagnóstico sensible omitido; no reintentar automáticamente.`,
  );
  process.exitCode = 1;
} finally {
  password = undefined;
  confirmation = undefined;
  if (webAuth && !evidence.sessionCleanup.webLogout) {
    try {
      const r = await webAuth.auth.signOut({ scope: "local" });
      evidence.sessionCleanup.webEmergencySignOut = !r.error;
    } catch {
      evidence.sessionCleanup.webEmergencySignOut = false;
    }
  } else if (context && !webAuth) {
    // A failed web login can still have emitted a cookie. Revoke that QA session.
    const remaining = await context.cookies().catch(() => []);
    if (remaining.some((c) => c.name.startsWith("credenly-admin-web-auth"))) {
      try {
        const requireWeb = createRequire(
          new URL("../../../apps/credenly-web/package.json", import.meta.url),
        );
        const { createServerClient } = requireWeb("@supabase/ssr");
        webAuth = browserAuth(createServerClient);
        const r = await webAuth.auth.signOut({ scope: "local" });
        evidence.sessionCleanup.webEmergencySignOut = !r.error;
      } catch {
        evidence.sessionCleanup.webEmergencySignOut = false;
      }
    }
  }
  if (passwordClient) {
    try {
      const r = await passwordClient.auth.signOut({ scope: "local" });
      evidence.sessionCleanup.authSignOut = !r.error;
    } catch {
      evidence.sessionCleanup.authSignOut = false;
    }
  }
  if (browser) await browser.close().catch(() => {});
  if (Object.values(evidence.sessionCleanup).some((v) => v === false)) {
    evidence.status = "STOPPED_SESSION_CLEANUP_REVIEW";
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await persist();
  console.log(
    `Resultado: ${evidence.status}. Evidencia sin secretos ${values["--output"] ? "guardada en el archivo indicado" : "solo en memoria"}.`,
  );
}
