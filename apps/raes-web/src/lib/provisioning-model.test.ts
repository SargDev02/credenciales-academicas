import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareCreation,
  CreationValidationError,
  isProvisioned,
} from "./provisioning-model";
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
test("institution creation sends only supported fields, no fixture or state override", () => {
  assert.deepEqual(
    prepareCreation(
      "institution",
      form({
        nombre: " Instituto sintético ",
        nit: "SYNTH-123",
        tipoInstitucion: "Prueba",
        codigoSnies: "",
        estado: "invented",
      }),
    ),
    {
      path: "/api/v1/admin/institutions",
      body: {
        nombre: "Instituto sintético",
        nit: "SYNTH-123",
        tipoInstitucion: "Prueba",
      },
    },
  );
});
test("client scopes come from explicit input, deduplicate and are left to backend validation", () => {
  const result = prepareCreation(
    "client",
    form({
      nombre: "Servicio sintético",
      tipoCliente: "OTRO",
      scopes: "persons:resolve, credentials:read,persons:resolve",
    }),
  );
  assert.deepEqual(result.body.scopes, ["persons:resolve", "credentials:read"]);
  assert.throws(
    () =>
      prepareCreation(
        "client",
        form({ nombre: "Servicio", tipoCliente: "OTRO", scopes: "" }),
      ),
    CreationValidationError,
  );
});
test("integration uses a valid institution and omits empty scopes for backend defaults", () => {
  assert.deepEqual(
    prepareCreation(
      "integration",
      form({
        nombre: "Prueba conector",
        institutionId: "00000000-0000-4000-8000-000000000001",
      }),
    ),
    {
      path: "/api/v1/admin/institutions/00000000-0000-4000-8000-000000000001/integrations",
      body: { nombre: "Prueba conector" },
    },
  );
  assert.throws(
    () =>
      prepareCreation(
        "integration",
        form({ nombre: "Prueba", institutionId: "../api-clients" }),
      ),
    CreationValidationError,
  );
});
test("creation validates malformed fields and unknown operation before any request", () => {
  assert.throws(
    () => prepareCreation("institution", form({ nombre: "a", nit: "a" })),
    (e) =>
      e instanceof CreationValidationError &&
      !!e.fields.nombre &&
      !!e.fields.nit &&
      !!e.fields.tipoInstitucion,
  );
  assert.throws(
    () =>
      prepareCreation(
        "client",
        form({ nombre: "Prueba", tipoCliente: "UNKNOWN", scopes: "*" }),
      ),
    CreationValidationError,
  );
  assert.throws(
    () => prepareCreation("unknown" as never, form({})),
    CreationValidationError,
  );
});
test("one-time credentials require a complete typed API response", () => {
  assert.equal(
    isProvisioned({
      data: {
        client: { id: "fixture" },
        scopes: ["credentials:read"],
        credentials: { clientId: "public-id", clientSecret: "test-secret" },
      },
    }),
    true,
  );
  assert.equal(
    isProvisioned({
      data: { credentials: { clientId: "public-id" }, scopes: [] },
    }),
    false,
  );
});
