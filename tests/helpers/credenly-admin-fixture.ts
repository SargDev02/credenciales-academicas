import { guardFixtureRequest } from "./http-fixture";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:https";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Entirely local Auth/PostgREST/RAES fixtures. No .env or remote SDK client.
// Real built Credenly API + Web processes exercise the production code paths.
export async function startAdminFixture() {
  const root = resolve(process.cwd()),
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
  const state = {
    inactive: false,
    metricsError: false,
    raesDown: false,
    empty: false,
    fullAuthPage: false,
    usersError: false,
    healthUnavailable: false,
    delayMs: 0,
  };
  let privateWrites = 0;
  const audits: Record<string, unknown>[] = [];
  const paths: string[] = [];
  const fixture = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    guardFixtureRequest(async (req, res) => {
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
      if (url.pathname === "/auth/v1/admin/users") {
        if (state.usersError)
          return reply(500, { message: "LOCAL_PRIVATE_MARKER" });
        const listed =
          state.empty || url.searchParams.get("page") === "2"
            ? []
            : state.fullAuthPage
              ? Array.from({ length: 20 }, (_, n) => ({
                  ...users[n % 2]!,
                  id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
                }))
              : users;
        return reply(200, {
          users: listed.map((u, n) => ({
            ...u,
            email_confirmed_at: n % 2 ? null : now,
            encrypted_password: "LOCAL_PRIVATE_MARKER",
            last_sign_in_at: n % 2 ? null : now,
          })),
          aud: "authenticated",
        });
      }
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
                  estado: state.inactive ? "INACTIVO" : "ACTIVO",
                },
              ]
            : [],
        );
      if (url.pathname === "/rest/v1/auditoria_admin") {
        if (req.method === "POST") {
          if (
            state.healthUnavailable &&
            JSON.parse(raw).accion === "HEALTH_READ"
          )
            return reply(500, { message: "LOCAL_PRIVATE_MARKER" });
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
        if (state.delayMs)
          await new Promise((resolve) => setTimeout(resolve, state.delayMs));
        if (state.metricsError) return reply(500, null);
        const total = url.pathname.endsWith("verificaciones_identidad")
          ? 5
          : url.pathname.endsWith("comparticiones")
            ? 3
            : 4;
        res.setHeader(
          "Content-Range",
          `*/${state.empty ? 0 : url.searchParams.has("estado") || url.searchParams.has("revoked_at") ? 1 : total}`,
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
        return state.raesDown
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
    }),
  );
  fixture.listen(3433);
  await once(fixture, "listening");
  const inherited = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "LANG"].flatMap((k) =>
      process.env[k] ? [[k, process.env[k]]] : [],
    ),
  );
  const common = {
    ...inherited,
    NODE_ENV: "production" as const,
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
      cwd: join(root, "apps/credenly-web"),
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

  async function stop() {
    api.kill("SIGTERM");
    web.kill("SIGTERM");
    await Promise.all([
      api.exitCode !== null ? Promise.resolve() : once(api, "exit"),
      web.exitCode !== null ? Promise.resolve() : once(web, "exit"),
    ]);
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
    rmSync(scratch, { recursive: true, force: true });
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
        } catch { /* Expected transient failure or optional diagnostic; no sensitive error output. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(ready, "Local fixture server unavailable");
    }
  } catch (error) {
    await stop();
    throw error;
  }
  return {
    base,
    apiBase,
    users,
    password,
    citizenId,
    adminId,
    tokenFor,
    state,
    audits,
    paths,
    privateWrites: () => privateWrites,
    stop,
    reset() {
      Object.assign(state, {
        inactive: false,
        metricsError: false,
        raesDown: false,
        empty: false,
        fullAuthPage: false,
        usersError: false,
        healthUnavailable: false,
        delayMs: 0,
      });
      audits.length = 0;
      paths.length = 0;
    },
  };
}
export type AdminFixture = Awaited<ReturnType<typeof startAdminFixture>>;
