import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/v1/admin/me/route";
import { authenticateAdmin, AdminAuthError } from "./admin-auth";
import { POST as createInstitution } from "../app/api/v1/admin/institutions/route";
import { POST as createClient } from "../app/api/v1/admin/api-clients/route";
import { POST as createIntegration } from "../app/api/v1/admin/institutions/[institutionId]/integrations/route";

process.env.RAES_SUPABASE_URL = "https://admin-me-fixture.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-only-never-public";
const request = (token: string | null = "fixture-session") =>
  new Request("http://localhost/api/v1/admin/me", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
async function fixture(
  options: {
    role?: string;
    state?: string;
    missing?: boolean;
    invalid?: boolean;
    lookupError?: boolean;
  },
  run: () => Promise<void>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(
      init?.method ?? "GET",
      "GET",
      "Introspection must be read-only",
    );
    const url = new URL(String(input));
    assert.equal(url.hostname, "admin-me-fixture.supabase.co");
    if (url.pathname === "/auth/v1/user")
      return options.invalid
        ? Response.json(
            { msg: "invalid or expired", code: "bad_jwt" },
            { status: 401 },
          )
        : Response.json({
            id: "admin-fixture",
            aud: "authenticated",
            role: "authenticated",
            email: "private@example.invalid",
            user_metadata: { role: "SUPERADMIN", internal: "not-for-ui" },
          });
    assert.equal(
      url.pathname,
      "/rest/v1/perfiles_admin",
      "Introspection must not write or access other tables",
    );
    if (options.lookupError)
      return Response.json(
        { code: "FIXTURE", message: "private SQL detail" },
        { status: 500 },
      );
    return Response.json(
      options.missing
        ? []
        : [
            {
              id: "admin-fixture",
              nombres: "Sintético",
              apellidos: "Administrativo",
              rol: options.role ?? "ADMIN",
              estado: options.state ?? "ACTIVO",
              unexpected: "not-for-ui",
            },
          ],
    );
  };
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

for (const rol of ["SUPERADMIN", "ADMIN", "AUDITOR"]) {
  test(`/admin/me: ${rol} ACTIVO recibe solo el perfil mínimo`, async () =>
    fixture({ role: rol }, async () => {
      const response = await GET(request());
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(await response.json(), {
        data: {
          id: "admin-fixture",
          nombres: "Sintético",
          apellidos: "Administrativo",
          rol,
          estado: "ACTIVO",
        },
      });
    }));
}
test("/admin/me: token ausente se rechaza sin consultar Supabase", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Must not call Supabase");
  };
  try {
    assert.equal((await GET(request(null))).status, 401);
  } finally {
    globalThis.fetch = original;
  }
});
for (const [label, options, status] of [
  ["inválido/expirado", { invalid: true }, 401],
  ["sin perfil", { missing: true }, 403],
  ["inactivo", { state: "INACTIVO" }, 403],
  ["rol desconocido", { role: "CITIZEN" }, 403],
] as const)
  test(`/admin/me: ${label} devuelve ${status}`, async () =>
    fixture(options, async () => {
      const response = await GET(request());
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal("data" in (await response.json()), false);
    }));
test("/admin/me: error de perfil no filtra detalles internos", async () =>
  fixture({ lookupError: true }, async () => {
    const response = await GET(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "AUTHENTICATION_ERROR",
      message: "No fue posible validar el perfil administrativo",
    });
  }));
test("introspección AUDITOR no amplía permisos ni cambia authenticateAdmin por defecto", async () =>
  fixture({ role: "AUDITOR" }, async () => {
    assert.equal((await GET(request())).status, 200);
    await assert.rejects(
      authenticateAdmin(request()),
      (e) => e instanceof AdminAuthError && e.code === "INSUFFICIENT_ROLE",
    );
    assert.equal((await createInstitution(request())).status, 403);
    assert.equal((await createClient(request())).status, 403);
    assert.equal(
      (
        await createIntegration(request(), {
          params: Promise.resolve({ institutionId: "fixture" }),
        })
      ).status,
      403,
    );
  }));
