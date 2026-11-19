import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  startAdminFixture,
  type AdminFixture,
} from "../helpers/credenly-admin-fixture";

let qa: AdminFixture;
const screenshots = "/tmp/credenly-admin-polish-qa";
test.beforeAll(async () => {
  qa = await startAdminFixture();
  await mkdir(screenshots, { recursive: true });
});
test.afterAll(async () => {
  await qa?.stop();
});
test.afterEach(() => {
  expect(qa.privateWrites()).toBe(0);
  qa.reset();
});

async function login(page: Page, admin = true, account = 1) {
  await page.goto(`${qa.base}/${admin ? "admin/login" : "login"}`);
  try {
    await page
      .getByLabel(admin ? "Correo" : "Correo electrónico", { exact: true })
      .fill(qa.users[account]!.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(qa.password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
  } catch {
    throw new Error(
      "Local fixture login interaction failed; sensitive diagnostics omitted",
    );
  }
}
async function authenticated(page: Page) {
  await login(page);
  await expect(page).toHaveURL(`${qa.base}/admin`);
  await expect(
    page.getByRole("heading", { name: "Resumen operativo", exact: true }),
  ).toBeVisible();
}
async function capture(page: Page, name: string) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({
    path: `${screenshots}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function api(path: string, id?: string) {
  return fetch(`${qa.apiBase}/api/v1/${path}`, {
    headers: id ? { authorization: `Bearer ${qa.tokenFor(id)}` } : {},
  });
}

test("admin login has distinct identity, labels, errors and no registration/recovery controls", async ({
  page,
}) => {
  await page.goto(`${qa.base}/admin`);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", {
      name: "Administración de Credenly",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Acceso exclusivo para operación del servicio.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo", { exact: true })).toHaveAttribute(
    "autocomplete",
    "username",
  );
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(
    page.getByRole("link", { name: /registr|recuper/i }),
  ).toHaveCount(0);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if ([360, 1440].includes(width)) await capture(page, `login-${width}`);
  }
  await page.getByLabel("Correo", { exact: true }).fill(qa.users[1]!.email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("local-invalid-fixture-only");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "No pudimos iniciar sesión",
  );
  await login(page, true, 0);
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Una cuenta ciudadana no concede",
  );
});

test("dashboard uses API totals and breakdowns, real readiness, consultation timestamps and honest empty incidents", async ({
  page,
}) => {
  await authenticated(page);
  const cards = page.locator(".operations-stats .ui-metric");
  await expect(cards).toHaveCount(4);
  for (const [n, title, total] of [
    [0, "Perfiles ciudadanos", "4"],
    [1, "Verificaciones documentales", "5"],
    [2, "Vinculaciones RAES", "4"],
    [3, "Comparticiones", "3"],
  ] as const) {
    await expect(
      cards.nth(n).getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(cards.nth(n).locator(".ui-metric-value")).toHaveText(total);
    await expect(
      cards.nth(n).getByRole("link", { name: /Ver detalle/ }),
    ).toBeVisible();
    await expect(cards.nth(n).locator("dl dd").first()).toHaveText("1");
  }
  await expect(page.locator(".operations-system")).toContainText("Operativo");
  await expect(page.locator(".operations-service-summary > div")).toHaveCount(
    3,
  );
  await expect(page.locator(".operations-heading time")).toHaveAttribute(
    "datetime",
    /T/,
  );
  await expect(
    page.getByRole("heading", {
      name: "Sin incidencias administrativas registradas.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".operations-incidents")).toContainText(
    "no significa que no existan errores",
  );
  await expect(page.locator(".operations-stats")).not.toContainText(
    /%|crecimiento|respecto/i,
  );
  const previous = qa.paths.filter((p) =>
    p.endsWith("HEAD /rest/v1/perfiles"),
  ).length;
  await page
    .getByRole("button", { name: "Actualizar consulta", exact: true })
    .click();
  await expect
    .poll(
      () => qa.paths.filter((p) => p.endsWith("HEAD /rest/v1/perfiles")).length,
    )
    .toBeGreaterThan(previous);
  await expect(
    page.getByRole("button", { name: "Actualizar consulta", exact: true }),
  ).toBeEnabled();
});

test("all administrative routes fit four widths with compact keyboard mobile navigation and 4-2-1 KPIs", async ({
  page,
}) => {
  const errors: string[] = [];
  const origins = new Set<string>();
  page.on("pageerror", (error) => errors.push(error.name));
  page.on("request", (req) => origins.add(new URL(req.url()).origin));
  await authenticated(page);
  const routes = [
    ["/admin", "Resumen operativo"],
    ["/admin/users", "Cuentas y perfiles"],
    ["/admin/verifications", "Verificación documental"],
    ["/admin/links", "Vinculaciones RAES"],
    ["/admin/shares", "Comparticiones"],
    ["/admin/health", "Salud del servicio"],
  ];
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, heading] of routes) {
      await page.goto(`${qa.base}${path}`);
      await expect(page.locator("main h1")).toHaveText(heading!);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} overflow at ${width}`,
      ).toBe(true);
      await expect(page.locator(".operations-header")).toHaveCount(1);
      if (path === "/admin")
        expect(
          await page
            .locator(".operations-stats")
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(/\s+/).length,
            ),
        ).toBe(width === 1440 ? 4 : width === 360 ? 1 : 2);
      if (
        [360, 1440].includes(width) &&
        [
          "/admin",
          "/admin/users",
          "/admin/health",
          "/admin/verifications",
        ].includes(path!)
      )
        await capture(page, `${path!.slice(1).replaceAll("/", "-")}-${width}`);
      if (width === 360) {
        const toggle = page.getByRole("button", { name: /Navegación/ });
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await toggle.focus();
        await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        const nav = page.getByRole("navigation", {
          name: "Administración de Credenly",
          exact: true,
        });
        await expect(nav.getByRole("link")).toHaveCount(6);
        await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          path!,
        );
        await nav.getByRole("link").first().focus();
        await page.keyboard.press("Escape");
        await expect(toggle).toBeFocused();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
      } else {
        await expect(
          page.getByRole("navigation", {
            name: "Administración de Credenly",
            exact: true,
          }),
        ).toBeVisible();
      }
    }
  }
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.getByRole("button", { name: /Navegación/ }).click();
  await page
    .getByRole("navigation", {
      name: "Administración de Credenly",
      exact: true,
    })
    .getByRole("link", { name: "Cuentas", exact: true })
    .click();
  await expect(page.locator("main h1")).toHaveText("Cuentas y perfiles");
  await expect(
    page.getByRole("button", { name: /Navegación/ }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
  expect([...origins]).toEqual([qa.base]);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
});

test("process sections show every real state, zeros and privacy explanations without controls", async ({
  page,
}) => {
  await authenticated(page);
  for (const [path, states, note] of [
    [
      "verifications",
      ["PENDIENTE", "PROCESADA", "APROBADA", "RECHAZADA", "REVISION"],
      "no constituye una validación legal de identidad",
    ],
    [
      "links",
      ["PENDIENTE", "VERIFICADA", "RECHAZADA", "REVOCADA"],
      "no almacena credenciales académicas",
    ],
    [
      "shares",
      ["ACTIVA", "REVOCADA", "EXPIRADA"],
      "Admin no puede recuperar tokens completos",
    ],
  ] as const) {
    await page.goto(`${qa.base}/admin/${path}`);
    const panel = page.locator(".operations-state-panel");
    await expect(panel.locator("li")).toHaveCount(states.length);
    for (const state of states)
      await expect(
        panel
          .locator(".ui-badge")
          .filter({ hasText: new RegExp(`^${state}$`) }),
      ).toBeVisible();
    await expect(page.locator("main")).toContainText(note);
    await expect(panel.getByRole("button")).toHaveCount(0);
  }
  qa.state.empty = true;
  await page.goto(`${qa.base}/admin/verifications`);
  await expect(page.locator(".operations-state-grid li > strong")).toHaveText([
    /0/,
    /0/,
    /0/,
    /0/,
    /0/,
  ]);
  await page.goto(`${qa.base}/admin`);
  await expect(page.locator(".ui-metric-value")).toHaveText([
    "0",
    "0",
    "0",
    "0",
  ]);
});

test("accounts retain complete UUIDs, minimal fields, copy feedback and real next/previous/empty pagination", async ({
  page,
  context,
}) => {
  await authenticated(page);
  await page.goto(`${qa.base}/admin/users`);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText([
    "UUID de cuenta",
    "Correo confirmado",
    "Fecha de registro",
    "Último acceso",
  ]);
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin confirmar", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sin acceso registrado", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody th code").first()).toHaveText(qa.citizenId);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: qa.base,
  });
  await page
    .getByRole("button", { name: `Copiar UUID ${qa.citizenId}`, exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "UUID copiado" }),
  ).toHaveText("UUID copiado");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    qa.citizenId,
  );
  await expect(page.locator("body")).not.toContainText(
    /LOCAL_PRIVATE_MARKER|@fixture\.invalid|encrypted_password|user_metadata|https:\/\/localhost:3433/,
  );
  qa.state.fullAuthPage = true;
  await page.goto(`${qa.base}/admin/users`);
  await page.getByRole("link", { name: /^Siguiente/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Sin cuentas en esta página",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Anterior/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.goto(`${qa.base}/admin/users?page=-1`);
  await expect(
    page.getByText("Página no válida", { exact: true }),
  ).toBeVisible();
  qa.state.empty = true;
  await page.goto(`${qa.base}/admin/users`);
  await expect(
    page.getByRole("heading", {
      name: "Sin cuentas en esta página",
      exact: true,
    }),
  ).toBeVisible();
});

test("health shows each dependency, readiness failure and partial dashboard failure without fabricated zeros", async ({
  page,
}) => {
  await authenticated(page);
  await page.goto(`${qa.base}/admin/health`);
  await expect(page.locator(".operations-dependency")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Supabase Auth", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".operations-dependencies")).toContainText(
    "No simula un inicio de sesión",
  );
  await expect(page.locator(".operations-system")).toContainText("HTTP 200");
  qa.state.raesDown = true;
  await page.goto(`${qa.base}/admin/health`);
  await expect(
    page.getByText("Requiere atención", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".operations-system")).toContainText("HTTP 503");
  await expect(
    page.locator(".operations-dependency").filter({ hasText: "RAES API" }),
  ).toContainText("No disponible");
  qa.state.raesDown = false;
  qa.state.healthUnavailable = true;
  await page.goto(`${qa.base}/admin`);
  await expect(
    page.getByRole("heading", { name: "Salud no disponible", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ui-metric-value").first()).toHaveText("4");
  await expect(page.locator("body")).not.toContainText("LOCAL_PRIVATE_MARKER");
});

test("loading and sanitized error states support retry and preserve genuine incident evidence", async ({
  page,
}) => {
  await authenticated(page);
  qa.state.delayMs = 2000;
  await page.goto(`${qa.base}/admin/verifications`, { waitUntil: "commit" });
  await expect(
    page.getByRole("heading", { name: "Cargando consulta", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".operations-loading [role=status]")).toHaveCount(
    5,
  );
  await expect(
    page.getByRole("heading", { name: "Verificación documental", exact: true }),
  ).toBeVisible();
  qa.state.delayMs = 0;
  qa.state.metricsError = true;
  await page.goto(`${qa.base}/admin/users`);
  await expect(
    page.getByText("No pudimos completar la consulta operativa", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".operations-state-panel")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /LOCAL_PRIVATE_MARKER|stack trace|SQL/,
  );
  qa.state.metricsError = false;
  await page
    .getByRole("button", { name: "Volver a intentar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cuentas y perfiles", exact: true }),
  ).toBeVisible();
  await page.goto(`${qa.base}/admin`);
  await expect(page.locator(".operations-incidents li")).not.toHaveCount(0);
});

test("citizen/admin isolation, active role and scoped logout remain enforced by the actual API", async ({
  page,
  context,
}) => {
  expect((await api("admin/me")).status).toBe(401);
  expect(
    (
      await fetch(`${qa.apiBase}/api/v1/admin/me`, {
        headers: { authorization: "Bearer invalid-local-only" },
      })
    ).status,
  ).toBe(401);
  expect((await api("admin/me", qa.citizenId)).status).toBe(403);
  expect((await api("admin/me", qa.adminId)).status).toBe(200);
  expect((await api("credentials", qa.adminId)).status).toBe(403);
  const credentials = await api("credentials", qa.citizenId);
  expect(credentials.status).toBe(200);
  expect(await credentials.json()).toEqual({
    data: [],
    source: "RAES",
    persistedByCredenly: false,
  });
  await login(page, false, 0);
  await expect(page).toHaveURL(`${qa.base}/credentials`);
  await expect(
    page.getByRole("heading", { name: "Aún no hay credenciales", exact: true }),
  ).toBeVisible();
  await authenticated(page);
  for (const name of ["credenly-web-auth", "credenly-admin-web-auth"]) {
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith(name),
    );
    expect(cookies.length).toBeGreaterThan(0);
    expect(
      cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Salir de administración", exact: true })
    .click();
  await expect(page).toHaveURL(`${qa.base}/admin/login`);
  expect(
    (await context.cookies()).some((cookie) =>
      cookie.name.startsWith("credenly-admin-web-auth"),
    ),
  ).toBe(false);
  await page.goto(`${qa.base}/credentials`);
  await expect(
    page.getByRole("heading", { name: "Mis credenciales", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page).toHaveURL(`${qa.base}/login`);
  await authenticated(page);
  await page.goto(`${qa.base}/credentials`);
  await expect(page).toHaveURL(`${qa.base}/login`);
  await login(page, false, 1);
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Si tu cuenta es administrativa",
  );
  qa.state.inactive = true;
  expect((await api("admin/me", qa.adminId)).status).toBe(403);
  await page.goto(`${qa.base}/admin`);
  await expect(
    page.getByText("No pudimos abrir la administración", { exact: true }),
  ).toBeVisible();
});

test("API security headers cover auth errors and local OCR admission rejects excess before processing", async () => {
  const denied = await api("credentials");
  expect(denied.status).toBe(401);
  expect(denied.headers.get("cache-control")).toBe("private, no-store");
  expect(denied.headers.get("x-content-type-options")).toBe("nosniff");
  expect(denied.headers.get("content-security-policy")).toContain("default-src 'none'");
  const attempts = [];
  for (let index = 0; index < 7; index++) attempts.push(await fetch(`${qa.apiBase}/api/v1/identity-verifications`, { method: "POST" }));
  expect(attempts.slice(0, 6).map(response => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
  const limited = attempts[6]!;
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(limited.headers.get("cache-control")).toBe("private, no-store");
  expect(await limited.json()).toEqual({ error: "RATE_LIMITED", message: "Demasiadas solicitudes. Intenta más tarde" });
});


test("restricted citizen profiles deny live API access and login without touching academic data", async ({ page, context }) => {
  for (const state of ["SUSPENDIDO", "CERRADO"]) {
    qa.state.citizenState = state;
    const before = qa.paths.length;
    for (const route of ["auth/me", "credentials", "shares", "identity-verifications"]) {
      const response = await api(route, qa.citizenId);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "CITIZEN_ACCOUNT_RESTRICTED", message: "El estado de tu cuenta no permite el acceso ciudadano" });
    }
    expect(qa.paths.slice(before).every(path => /\/(auth\/v1\/user|rest\/v1\/perfiles_admin|rest\/v1\/perfiles)$/.test(path))).toBe(true);
    await login(page, false, 0);
    await expect(page.locator("form").getByRole("alert")).toContainText("El estado de tu cuenta no permite el acceso ciudadano");
    expect((await context.cookies()).some(cookie => cookie.name.startsWith("credenly-web-auth"))).toBe(false);
  }
  qa.state.citizenState = "ACTIVO";
  await login(page, false, 0);
  await expect(page).toHaveURL(`${qa.base}/credentials`);
});
