import test from "node:test";
import assert from "node:assert/strict";
import { parseConnectorEnv } from "./env";
import { parseArgs } from "./options";
import { RaesClient } from "./raes-client";
import {
  createInstitutionSourceClient,
  type InstitutionalSnapshot,
} from "./source";
import { detect } from "./sync";

const config = {
  UDEA_SUPABASE_URL: "https://udea.fixture.invalid",
  UDEA_SUPABASE_SERVICE_ROLE_KEY: "local-udea-fixture-only-key",
  RAES_API_BASE_URL: "https://raes.fixture.invalid",
  RAES_UDEA_CLIENT_ID: "local-udea-fixture-client",
  RAES_UDEA_CLIENT_SECRET: "local-udea-fixture-only-secret",
};
test("UdeA configuration uses its own credentials and never falls back to Poli", () => {
  assert.deepEqual(parseConnectorEnv(config), config);
  assert.throws(
    () => parseConnectorEnv({ POLI_SUPABASE_URL: config.UDEA_SUPABASE_URL }),
    /UDEA_SUPABASE_URL/,
  );
  assert.throws(
    () => parseConnectorEnv({ ...config, RAES_UDEA_CLIENT_SECRET: "" }),
    /RAES_UDEA_CLIENT_SECRET/,
  );
});
test("UdeA configuration errors identify fields without reflecting credential values", () => {
  const marker = "fixture-private-marker";
  assert.throws(
    () => parseConnectorEnv({ ...config, UDEA_SUPABASE_URL: marker }),
    (error) => error instanceof Error && !error.message.includes(marker),
  );
});
test("CLI detects proposals and rejects retired sync modes", () => {
  assert.deepEqual(parseArgs([]), { credentialCode: null });
  assert.deepEqual(parseArgs(["--", "--credential-code= SYNTH-UDEA-QA "]), { credentialCode: "SYNTH-UDEA-QA" });
  for (const flag of ["--only=base", "--only=credentials", "--unknown"]) assert.throws(() => parseArgs([flag]));
});
test("source client sends only the UdeA server credential to the UdeA project", async () => {
  const original = globalThis.fetch;
  const seen: { url: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    seen.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return Response.json([]);
  };
  try {
    const source = createInstitutionSourceClient(config);
    const result = await source.from("institucion").select("id").limit(1);
    assert.equal(result.error, null);
    assert.ok(
      seen[0]?.url.startsWith(
        `${config.UDEA_SUPABASE_URL}/rest/v1/institucion`,
      ),
    );
    assert.equal(
      seen[0]?.authorization,
      `Bearer ${config.UDEA_SUPABASE_SERVICE_ROLE_KEY}`,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("UdeA submits observations with its own integration and zero canonical writes", async () => {
  const original = globalThis.fetch;
  const seen: { url: string; authorization: string | null; body: unknown }[] =
    [];
  globalThis.fetch = async (input, init) => {
    seen.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as unknown,
    });
    return Response.json({ data: { observaciones: [{ id: "00000000-0000-4000-8000-000000000501", estado: "PENDIENTE", nueva: true }] } });
  };
  try {
    const raes = new RaesClient(config);
    assert.equal(raes.namespace, "udea");
    const snapshot: InstitutionalSnapshot = {
      institution: {
        nit: "900123456-7",
        codigo_snies: null,
        nombre: "Universidad sintética de QA",
        tipo_institucion: "UNIVERSIDAD",
        estado: "ACTIVA",
      },
      campuses: [],
      programs: [],
      programCampuses: [],
      students: [{ id: "SYNTH-STUDENT", tipo_documento: "CC", numero_documento: "SYNTH-UDEA-QA", primer_nombre: "Persona", segundo_nombre: null, primer_apellido: "Sintética", segundo_apellido: null }],
      enrollments: [],
      credentials: [],
    };
    const result = await detect(snapshot, raes, "00000000-0000-4000-8000-000000000601");
    assert.equal(result.proposalsCreated, 1);
    assert.equal(result.canonicalWrites, 0);
    assert.equal(seen.length, 1);
    assert.equal(
      seen[0]?.url,
      `${config.RAES_API_BASE_URL}/api/v1/academic-review/proposals`,
    );
    assert.equal(
      seen[0]?.authorization,
      `Bearer ${config.RAES_UDEA_CLIENT_ID}.${config.RAES_UDEA_CLIENT_SECRET}`,
    );
    assert.equal(
      (seen[0]?.body as { observacion: { persona: { identificadorOrigen: string } } }).observacion.persona.identificadorOrigen,
      "SYNTH-STUDENT",
    );
  } finally {
    globalThis.fetch = original;
  }
});
