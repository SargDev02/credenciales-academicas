import { chromiumLaunchOptions } from "../../../tests/helpers/browser.mjs";
import { guardFixtureRequest } from "../../../tests/helpers/http-fixture";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Explicit local API fixture; real Auth only. Academic/state fixtures exist solely
// in this operator process, never in product code or a remote database.
assert.ok(process.argv.includes("--temporary-citizen"));
assert.equal(
  new URL(process.env.CREDENLY_SUPABASE_URL!).hostname,
  "rleocqxvahtbswclqmif.supabase.co",
);
const db = createClient(
  process.env.CREDENLY_SUPABASE_URL!,
  process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const base = "http://localhost:3205";
const email = `synthetic-frontend-${randomUUID()}@example.invalid`,
  password = randomBytes(32).toString("base64url");
const token = `crdn_shr_${randomBytes(32).toString("base64url")}`;
const credentialId = randomUUID(),
  now = "2026-10-18T12:00:00Z";
const credential = {
  id: credentialId,
  codigoRaes: "LOCAL-QA-ONLY",
  tipo: "DIPLOMA",
  categoria: "Prueba local",
  estadoActual: "VIGENTE",
  versionActual: 1,
  revocadaAt: null,
  motivoRevocacion: null,
  anuladaAt: null,
  motivoAnulacion: null,
  institucion: {
    id: randomUUID(),
    nit: "SYNTH-LOCAL",
    nombre: "Institución sintética de QA",
  },
  programa: {
    id: randomUUID(),
    nombre: "Programa de prueba local",
    codigo_snies: null,
  },
  sede: { id: randomUUID(), nombre: "Sede de prueba local", municipio: null },
  version: {
    numeroVersion: 1,
    titulo: "Credencial sintética de QA local",
    descripcion: "Fixture solo en memoria",
    fechaEmision: now,
    fechaGrado: now,
    estadoReportado: "VIGENTE",
    numeroActa: null,
    numeroFolio: null,
    numeroLibro: null,
  },
};
let profile: unknown = null,
  verification: Record<string, unknown> | null = null,
  link: unknown = null;
let verificationState = "REVISION",
  publicMode = "active",
  academicState = "VIGENTE",
  empty = false;
let share: Record<string, unknown> | null = null;
let userId: string | undefined, session: string | undefined;
let loggedOut = false;
const api = createServer(guardFixtureRequest(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status: number, payload: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(payload));
  };
  if (req.url?.startsWith("/api/v1/public/shares/")) {
    if (publicMode === "revoked") return reply(410, { error: "SHARE_REVOKED" });
    if (publicMode === "expired") return reply(410, { error: "SHARE_EXPIRED" });
    if (publicMode === "missing")
      return reply(404, { error: "SHARE_NOT_FOUND" });
    if (publicMode === "error")
      return reply(503, { message: "private database detail must not render" });
    return reply(200, {
      data: {
        share: { id: randomUUID(), expiresAt: "2099-01-01T00:00:00Z" },
        credential: {
          codigoRaes: credential.codigoRaes,
          tipo: credential.tipo,
          categoria: credential.categoria,
          estadoActual: academicState,
          versionActual: 1,
          titulo: credential.version.titulo,
          institucion: credential.institucion,
          fechaEmision: now,
          fechaEstadoTerminal: academicState === "VIGENTE" ? null : now,
        },
        source: "RAES",
        persistedByCredenly: false,
        verifiedAt: now,
      },
    });
  }
  const authToken = req.headers.authorization?.replace(/^Bearer /, "");
  if (!authToken) return reply(401, { error: "SESSION_INVALID" });
  if (authToken !== session) {
    const result = await db.auth.getUser(authToken);
    if (result.data.user?.id !== userId) return reply(401, {});
    session = authToken;
  }
  if (req.method === "GET") {
    const payloads: Record<string, unknown> = {
      "/api/v1/auth/me": { id: userId },
      "/api/v1/profile": profile,
      "/api/v1/identity-verifications": verification,
      "/api/v1/raes/link": link,
      "/api/v1/shares": share ? [share] : [],
    };
    if (req.url === "/api/v1/credentials")
      return reply(200, {
        data: empty
          ? []
          : [
              {
                ...credential,
                estadoActual: academicState,
                revocadaAt: academicState === "REVOCADA" ? now : null,
                motivoRevocacion:
                  academicState === "REVOCADA"
                    ? "Motivo sintético de revocación"
                    : null,
                anuladaAt: academicState === "ANULADA" ? now : null,
                motivoAnulacion:
                  academicState === "ANULADA"
                    ? "Motivo sintético de anulación"
                    : null,
              },
            ],
        source: "RAES",
        persistedByCredenly: false,
      });
    if (req.url! in payloads) return reply(200, { data: payloads[req.url!] });
  }
  let raw = Buffer.alloc(0);
  for await (const chunk of req) raw = Buffer.concat([raw, chunk]);
  if (req.url === "/api/v1/profile" && req.method === "PUT") {
    const body = JSON.parse(raw.toString());
    profile = { id: userId, ...body, estado: "ACTIVO" };
    return reply(200, { data: profile });
  }
  if (req.url === "/api/v1/identity-verifications" && req.method === "POST") {
    const body = await new Response(raw, {
      headers: { "content-type": req.headers["content-type"]! },
    }).formData();
    assert.ok(body.get("documento") instanceof File);
    verification = {
      id: randomUUID(),
      tipoDocumento: "CC",
      numeroDocumento: "LOCAL-SYNTHETIC-QA",
      nombres: "Prueba",
      apellidos: "Sintética",
      estado: verificationState,
      motivoFallo:
        verificationState === "RECHAZADA"
          ? "No se leyó el documento de prueba"
          : null,
      motivoRevision:
        verificationState === "REVISION" ? "Prueba en revisión" : null,
      canLinkRaes: verificationState === "APROBADA",
    };
    return reply(201, { data: verification });
  }
  if (req.url === "/api/v1/raes/link" && req.method === "POST") {
    assert.equal(verification?.estado, "APROBADA");
    link = {
      id: randomUUID(),
      raesPersonaId: randomUUID(),
      verificacionIdentidadId: verification.id,
      estado: "VERIFICADA",
    };
    return reply(200, { data: link });
  }
  if (req.url === "/api/v1/shares" && req.method === "POST") {
    const body = JSON.parse(raw.toString());
    assert.equal(body.raesCredencialId, credentialId);
    assert.ok(body.expiresInHours >= 1 && body.expiresInHours <= 720);
    share = {
      id: randomUUID(),
      raesCredencialId: credentialId,
      tokenPrefix: token.slice(0, 16),
      camposVisibles: body.camposVisibles,
      expiresAt: "2099-01-01T00:00:00Z",
      revokedAt: null,
      estado: "ACTIVA",
      createdAt: now,
    };
    return reply(201, { data: { ...share, token, tokenReturnedOnce: true } });
  }
  if (req.method === "DELETE" && req.url === `/api/v1/shares/${share?.id}`) {
    share = { ...share, estado: "REVOCADA", revokedAt: now };
    return reply(200, { data: share });
  }
  reply(404, { error: "LOCAL_FIXTURE_NOT_FOUND" });
}));
api.listen(3402, "127.0.0.1");
await once(api, "listening");
const env: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  CREDENLY_API_BASE_URL: "http://127.0.0.1:3402",
  CREDENLY_WEB_SITE_URL: base,
};
for (const key of [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "CREDENLY_WEB_SUPABASE_URL",
  "CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY",
])
  if (process.env[key]) env[key] = process.env[key]!;
const web = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3205"],
  { env, stdio: "ignore" },
);
const browser = await chromium.launch(chromiumLaunchOptions);
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
const origins = new Set<string>();
page.on("pageerror", (e) => errors.push(e.name));
page.on("request", (r) => origins.add(new URL(r.url()).origin));
mkdirSync("/tmp/frontend-qa", { recursive: true });
try {
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch(`${base}/login`)).ok) break;
    } catch { /* Expected transient failure or optional diagnostic; no sensitive error output. */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ok(!created.error && created.data.user);
  userId = created.data.user.id;
  await page.goto(`${base}/credentials`);
  await page.waitForURL("**/login");
  await page.goto(`${base}/register`);
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "minlength",
    "12",
  );
  await page.goto(`${base}/login`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await page.waitForURL("**/onboarding");
  await page
    .getByRole("heading", { name: "Conecta tu historia académica" })
    .waitFor();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Onboarding overflows at ${width}`,
    );
  }

  await page.getByLabel("Nombres", { exact: true }).fill("Prueba");
  await page.getByLabel("Apellidos", { exact: true }).fill("Sintética");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await page.getByText("Perfil guardado.", { exact: true }).waitFor();
  for (const state of ["PENDIENTE", "REVISION", "RECHAZADA", "APROBADA"]) {
    verificationState = state;
    await page.getByLabel("Imagen del documento").setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic local fixture"),
    });
    await page
      .getByRole("button", { name: "Enviar documento", exact: true })
      .click();
    await page
      .getByText(
        state === "REVISION"
          ? "En revisión"
          : state === "PENDIENTE"
            ? "Pendiente"
            : state === "RECHAZADA"
              ? "Rechazada"
              : "Aprobada",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Vincular con RAES" }).count(),
      state === "APROBADA" ? 1 : 0,
    );
  }
  await page.getByRole("button", { name: "Vincular con RAES" }).click();
  await page.getByText("Identidad vinculada", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Ir a mis credenciales" }).click();
  await page.waitForURL("**/credentials");
  await expect(page.getByRole("article")).toHaveCount(1);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/frontend-qa/credenly-credentials-${width}.png`,
      fullPage: true,
    });
  }
  for (const state of ["REVOCADA", "ANULADA"]) {
    academicState = state;
    await page.goto(`${base}/credentials/${credentialId}`);
    await page
      .getByText(
        state === "REVOCADA"
          ? "Motivo sintético de revocación"
          : "Motivo sintético de anulación",
      )
      .waitFor();
  }
  academicState = "VIGENTE";
  empty = true;
  await page.goto(`${base}/credentials`);
  await page
    .getByRole("heading", { name: "Aún no hay credenciales" })
    .waitFor();
  empty = false;
  await page.goto(`${base}/shares?credential=${credentialId}`);
  await page.getByRole("heading", { name: "Tus comparticiones" }).waitFor();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Shares overflow at ${width}`,
    );
    await page.screenshot({
      path: `/tmp/frontend-qa/credenly-shares-${width}.png`,
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await page.getByLabel("Enlace de verificación").waitFor();
  assert.equal(
    await page.getByLabel("Enlace de verificación").inputValue(),
    `${base}/verify/${token}`,
  );
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await page.getByRole("button", { name: "Cerrar enlace" }).click();
  assert.equal(await page.getByLabel("Enlace de verificación").count(), 0);
  await page.reload();
  assert.equal(await page.getByLabel("Enlace de verificación").count(), 0);
  await page.getByRole("button", { name: "Revocar acceso" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await page.getByText("Revocada", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.waitForURL("**/login");
  loggedOut = true;
  const cookies = (await context.cookies()).filter((c) =>
    c.name.startsWith("credenly-web-auth"),
  );
  assert.equal(cookies.length, 0);
  for (const [mode, heading] of [
    ["active", "Estado actual de la credencial"],
    ["revoked", "Enlace revocado"],
    ["expired", "Enlace expirado"],
    ["missing", "Información no disponible"],
    ["error", "No pudimos consultar RAES"],
  ] as const) {
    publicMode = mode;
    await page.goto(`${base}/verify/${token}`);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.equal(
      (await page.locator("body").textContent())!.includes(
        "private database detail",
      ),
      false,
    );
    if (mode === "active") {
      for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `Public view overflows at ${width}`,
        );
      }
    }
    if (mode === "active")
      assert.equal(
        await page
          .getByText(
            "Información consultada desde RAES. El resultado corresponde al estado actual.",
          )
          .count(),
        1,
      );
  }
  publicMode = "active";
  for (const state of ["REVOCADA", "ANULADA"]) {
    academicState = state;
    await page.goto(`${base}/verify/${token}`);
    await page
      .getByText(
        state === "REVOCADA" ? "Credencial revocada" : "Credencial anulada",
        { exact: true },
      )
      .waitFor();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual([...origins], [base]);
} catch (e) {
  throw new Error(
    `Citizen browser QA failed (${e instanceof Error ? e.name : "Unknown"}), path=${new URL(page.url()).pathname.split("/").slice(0, 2).join("/")}; no token diagnostics saved`,
  );
} finally {
  if (userId) {
    if (session && !loggedOut) {
      const revoke = await db.auth.admin.signOut(session, "global");
      assert.ok(!revoke.error, "Stop: temporary session cleanup failed");
    }
    for (const table of [
      "vinculaciones_raes",
      "verificaciones_identidad",
      "perfiles",
    ]) {
      const field = table === "perfiles" ? "id" : "usuario_id";
      const remove = await db.from(table).delete().eq(field, userId);
      assert.ok(!remove.error, `Stop: ${table} cleanup failed`);
      const remaining = await db.from(table).select(field).eq(field, userId);
      assert.ok(!remaining.error && remaining.data?.length === 0);
    }
    const remove = await db.auth.admin.deleteUser(userId);
    assert.ok(!remove.error, "Stop: temporary Auth cleanup failed");
    const check = await db.auth.admin.getUserById(userId);
    assert.equal(check.error?.status, 404);
  }
  await browser.close();
  web.kill("SIGTERM");
  api.close();
}
console.log(
  JSON.stringify({
    citizenUi: "LOCAL_API_FIXTURE_OK",
    auth: "REAL",
    verificationStates: ["PENDIENTE", "REVISION", "RECHAZADA", "APROBADA"],
    academicStates: ["VIGENTE", "REVOCADA", "ANULADA"],
    sharing: "CREATE_REVOKE_TOKEN_DISCARD_OK",
    publicStates: [200, 410, 404, 503],
    widths: [360, 768, 1024, 1440],
    temporaryUserId: userId,
    temporaryUserRemoved: true,
    remoteAcademicWrites: 0,
    hydrationErrors: 0,
  }),
);
