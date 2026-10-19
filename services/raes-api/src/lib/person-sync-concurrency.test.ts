import test from "node:test";
import assert from "node:assert/strict";
import type { Persona } from "@raes/contracts";
import { syncPerson } from "./academic-sync";
import { ApiError } from "./api-error";

process.env.RAES_SUPABASE_URL = "https://person-race-fixture.supabase.co";
process.env.RAES_SUPABASE_SERVICE_ROLE_KEY = "fixture-server-only-never-public";
const identity = { institutionId: "institution", integrationId: "integration", clientId: "client", integrationName: "fixture", scopes: [] };
const person = (document: string): Persona => ({ identificadorOrigen: "shared-source", tipoDocumento: "CC", numeroDocumento: document, primerNombre: "Synthetic", primerApellido: "Fixture" });

async function race(documents: [string, string]) {
  const originalFetch = globalThis.fetch;
  const masters = new Map<string, { id: string; tipo_documento: string; numero_documento: string }>();
  let source: { id: string; persona_id: string } | null = null;
  let lookups = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "person-race-fixture.supabase.co");
    const table = url.pathname.split("/").at(-1);
    if (table === "persona_fuentes" && init?.method === "POST") {
      const headers = new Headers(init.headers);
      assert.match(headers.get("prefer") ?? "", /resolution=ignore-duplicates/);
      const row = JSON.parse(String(init.body)) as { persona_id: string; institucion_id: string; identificador_origen: string };
      assert.equal(row.institucion_id, identity.institutionId);
      assert.equal(row.identificador_origen, "shared-source");
      source ??= { id: "source", persona_id: row.persona_id };
      return new Response(null, { status: 201 });
    }
    if (table === "persona_fuentes") {
      assert.equal(url.searchParams.get("institucion_id"), "eq.institution");
      // Both requests must observe absence before either can INSERT.
      if (++lookups <= 2) { if (lookups === 2) release(); await barrier; return Response.json([]); }
      return Response.json(source);
    }
    if (table === "personas_maestra") {
      if (init?.method === "POST") {
        const row = JSON.parse(String(init.body)) as { tipo_documento: string; numero_documento: string };
        if (!masters.has(row.numero_documento)) masters.set(row.numero_documento, { id: `master-${row.numero_documento}`, ...row });
        return new Response(null, { status: 201 });
      }
      const document = url.searchParams.get("numero_documento")?.slice(3) ?? "";
      const row = masters.get(document);
      return Response.json(new Headers(init?.headers).get("accept")?.includes("object") ? row : row ? [row] : []);
    }
    throw new Error("Unexpected fixture operation");
  };
  try { return { results: await Promise.allSettled(documents.map(doc => syncPerson(identity, person(doc)))), source: () => source, masters }; }
  finally { globalThis.fetch = originalFetch; }
}

test("concurrent claims of one institutional source cannot reassign its master identity", async () => {
  const { results, source } = await race(["SYNTH-RACE-A", "SYNTH-RACE-B"]);
  const successes = results.filter(r => r.status === "fulfilled");
  const failures = results.filter(r => r.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(successes[0]?.value.personId, source()?.persona_id);
  const error: unknown = failures[0]?.reason;
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 409);
  assert.equal(error.code, "PERSON_SOURCE_IDENTITY_CONFLICT");
});
test("concurrent identical documents converge to one master and one source", async () => {
  const { results, masters } = await race(["SYNTH-RACE-SAME", "SYNTH-RACE-SAME"]);
  assert.equal(masters.size, 1);
  assert.ok(results.every(r => r.status === "fulfilled"));
  assert.deepEqual(results[0], results[1]);
});
