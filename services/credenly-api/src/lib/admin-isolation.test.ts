import assert from "node:assert/strict";
import test from "node:test";
import { GET as me } from "../app/api/v1/admin/me/route";
import { GET as overview } from "../app/api/v1/admin/overview/route";
import { GET as accounts } from "../app/api/v1/admin/users/route";
import { GET as health } from "../app/api/v1/admin/health/route";
import { GET as citizenMe } from "../app/api/v1/auth/me/route";
import { GET as credentials } from "../app/api/v1/credentials/route";
import { PUT as profile } from "../app/api/v1/profile/route";
import { GET as verifications } from "../app/api/v1/identity-verifications/route";
import { POST as link } from "../app/api/v1/raes/link/route";
import { GET as shares } from "../app/api/v1/shares/route";

Object.assign(process.env, {
  CREDENLY_SUPABASE_URL: "https://admin-fixture.supabase.co",
  CREDENLY_SUPABASE_SERVICE_ROLE_KEY: "fixture-service-only-never-public",
  RAES_API_BASE_URL: "https://raes-fixture.example",
  RAES_CREDENLY_CLIENT_ID: "raes_cli_fixture",
  RAES_CREDENLY_CLIENT_SECRET: "fixture-private-raes-secret",
});
const id = "00000000-0000-4000-8000-000000000001";
const request = (path = "me", token: string | null = "fixture-session") =>
  new Request(`http://localhost/api/v1/admin/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
async function fixture(
  options: {
    missing?: boolean;
    state?: string;
    role?: string;
    invalid?: boolean;
    lookupError?: boolean;
    auditError?: boolean;
    metricsError?: boolean;
    authListError?: boolean;
  } = {},
  run: (audit: Record<string, unknown>[], paths: string[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const audits: Record<string, unknown>[] = [];
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    paths.push(`${init?.method ?? "GET"} ${url.hostname}${url.pathname}`);
    if (url.pathname === "/auth/v1/user")
      return options.invalid
        ? Response.json({ msg: "invalid", code: "bad_jwt" }, { status: 401 })
        : Response.json({
            id,
            email: "admin@fixture.invalid",
            created_at: "2026-10-18",
            aud: "authenticated",
            role: "authenticated",
            user_metadata: {
              rol: "ADMIN_CREDENLY",
              estado: "ACTIVO",
              internal: "sensitive-fixture",
            },
          });
    if (url.pathname === "/rest/v1/perfiles_admin")
      return options.lookupError
        ? Response.json(
            { code: "FIXTURE", message: "private SQL" },
            { status: 500 },
          )
        : Response.json(
            options.missing
              ? []
              : [
                  {
                    id,
                    nombres: "Operador",
                    apellidos: "Sintético",
                    rol: options.role ?? "ADMIN_CREDENLY",
                    estado: options.state ?? "ACTIVO",
                    internal: "sensitive-fixture",
                  },
                ],
          );
    if (url.pathname === "/rest/v1/auditoria_admin") {
      if (init?.method === "POST") {
        audits.push(JSON.parse(String(init.body)));
        return options.auditError
          ? Response.json(
              { code: "FIXTURE", message: "private SQL" },
              { status: 500 },
            )
          : new Response(null, { status: 201 });
      }
      return Response.json([
        {
          id,
          accion: "OPERATIONS_READ",
          resultado: "ERROR",
          created_at: "2026-10-18T12:00:00Z",
        },
      ]);
    }
    if (url.pathname === "/auth/v1/admin/users")
      return options.authListError
        ? Response.json({ msg: "private SQL" }, { status: 500 })
        : Response.json({
            users: [
              {
                id,
                email: "sensitive-fixture@example.invalid",
                encrypted_password: "sensitive-fixture",
                email_confirmed_at: "2026-10-18",
                created_at: "2026-10-18",
                last_sign_in_at: null,
                user_metadata: { internal: "sensitive-fixture" },
              },
            ],
            aud: "authenticated",
          });
    if (init?.method === "HEAD") {
      if (options.metricsError) return new Response(null, { status: 500 });
      const table = url.pathname.split("/").at(-1);
      const total =
        table === "verificaciones_identidad"
          ? 5
          : table === "comparticiones"
            ? 3
            : 4;
      const count =
        url.searchParams.has("estado") || url.searchParams.has("revoked_at")
          ? 1
          : total;
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${count}` },
      });
    }
    if (
      url.hostname === "raes-fixture.example" &&
      url.pathname === "/api/v1/auth/client-whoami"
    )
      return Response.json({
        data: {
          id: "fixture",
          clientId: "fixture",
          nombre: "fixture",
          tipoCliente: "CREDENLY",
          scopes: [],
        },
      });
    throw new Error("Unexpected fixture request");
  };
  try {
    await run(audits, paths);
  } finally {
    globalThis.fetch = original;
  }
}
test("admin/me: token ausente -> 401 sin consultar Auth", async () =>
  fixture({}, async (audit, paths) => {
    assert.equal((await me(request("me", null))).status, 401);
    assert.deepEqual(paths, []);
    assert.deepEqual(audit, []);
  }));
for (const [name, options, status] of [
  ["inválido", { invalid: true }, 401],
  ["ciudadano con email admin y metadata manipulada", { missing: true }, 403],
  ["inactivo", { state: "INACTIVO" }, 403],
  ["rol incorrecto", { role: "SUPERADMIN" }, 403],
  ["fallo de validación", { lookupError: true }, 503],
] as const)
  test(`admin/me: ${name} -> ${status}`, async () =>
    fixture(options, async () => {
      const response = await me(request());
      assert.equal(response.status, status);
      assert.equal("data" in (await response.json()), false);
    }));
test("ADMIN_CREDENLY ACTIVO recibe solo perfil mínimo y consulta auditada", async () =>
  fixture({}, async (audit) => {
    const response = await me(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      data: {
        id,
        nombres: "Operador",
        apellidos: "Sintético",
        rol: "ADMIN_CREDENLY",
        estado: "ACTIVO",
      },
    });
    assert.deepEqual(audit, [
      {
        actor_id: id,
        accion: "ADMIN_PROFILE_READ",
        resultado: "EXITO",
        recurso_tipo: "ADMIN_PROFILE",
        recurso_id: id,
      },
    ]);
  }));
for (const [name, route] of [
  ["overview", overview],
  ["users", accounts],
  ["health", health],
] as const) {
  test(`${name}: ciudadano sin perfil admin -> 403 antes de consultar datos operativos`, async () =>
    fixture({ missing: true }, async (_audit, paths) => {
      assert.equal((await route(request(name))).status, 403);
      assert.equal(paths.length, 2);
    }));
  test(`${name}: fallo de auditoría -> 503 sin entregar información`, async () =>
    fixture({ auditError: true }, async () => {
      const response = await route(request(name));
      assert.equal(response.status, 503);
      assert.equal("data" in (await response.json()), false);
    }));
}
test("overview: agregados reales, comparticiones exclusivas e incidentes de fuente real", async () =>
  fixture({}, async (audit) => {
    const response = await overview(request("overview"));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.verifications.total, 5);
    assert.deepEqual(data.shares, {
      total: 3,
      byState: { ACTIVA: 1, REVOCADA: 1, EXPIRADA: 1 },
    });
    assert.equal(data.incidentSource, "auditoria_admin");
    assert.equal(data.incidents[0].result, "ERROR");
    assert.equal(audit[0]!.accion, "OPERATIONS_READ");
    assert.equal(JSON.stringify(data).includes("sensitive-fixture"), false);
  }));
test("fallo de conteo registra ERROR sin inventar ceros o reflejar SQL", async () =>
  fixture({ metricsError: true }, async (audit) => {
    const response = await overview(request("overview"));
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes("SQL"), false);
    assert.equal(audit[0]!.resultado, "ERROR");
  }));
test("users: proyección de registro omite email, hashes, metadata, sesiones y tokens", async () =>
  fixture({}, async () => {
    const response = await accounts(request("users?page=2"));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.page, 2);
    assert.deepEqual(
      Object.keys(data.items[0]).sort(),
      ["id", "emailConfirmed", "createdAt", "lastSignInAt"].sort(),
    );
    assert.equal(JSON.stringify(data).includes("sensitive-fixture"), false);
  }));
test("users: página inválida -> 400 auditado, sin listar Auth", async () =>
  fixture({}, async (audit, paths) => {
    assert.equal((await accounts(request("users?page=-1"))).status, 400);
    assert.equal(
      paths.some((p) => p.includes("/admin/users")),
      false,
    );
    assert.equal(audit[0]!.resultado, "ERROR");
  }));
for (const state of ["ACTIVO", "INACTIVO"])
  test(`admin ${state} no obtiene acceso ciudadano automáticamente`, async () =>
    fixture({ state }, async (_audit, paths) => {
      for (const route of [
        citizenMe,
        credentials,
        profile,
        verifications,
        link,
        shares,
      ])
        assert.equal((await route(request())).status, 403);
      assert.equal(
        paths.some(
          (path) => path.includes("raes-fixture") || path.includes("POST "),
        ),
        false,
      );
    }));
test("ciudadano existente conserva su identidad Auth sin elevarse por nombre/email", async () =>
  fixture({ missing: true }, async () => {
    const response = await citizenMe(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.id, id);
  }));
test("fallo al descartar perfil admin bloquea acceso ciudadano de forma segura", async () =>
  fixture({ lookupError: true }, async () => {
    assert.equal((await credentials(request())).status, 503);
  }));
