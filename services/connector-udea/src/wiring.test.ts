import test from "node:test";
import assert from "node:assert/strict";
import { parseConnectorEnv } from "./env";
import { parseArgs } from "./options";
import { RaesClient } from "./raes-client";
import {
  createInstitutionSourceClient,
  type InstitutionalSnapshot,
} from "./source";
import { synchronize } from "./sync";

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
test("CLI preserves sync modes and credential selection; unknown options fail closed", () => {
  assert.deepEqual(parseArgs([]), { mode: "all", credentialCode: null });
  assert.deepEqual(
    parseArgs([
      "--",
      "--only=credentials",
      "--credential-code= SYNTH-UDEA-QA ",
    ]),
    { mode: "credentials", credentialCode: "SYNTH-UDEA-QA" },
  );
  assert.equal(parseArgs(["--only=base"]).mode, "base");
  assert.throws(() => parseArgs(["--only=unexpected"]));
  assert.throws(() => parseArgs(["--unknown"]));
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
test("UdeA client uses its namespace and integration when calling the shared synchronization core", async () => {
  const original = globalThis.fetch;
  const seen: { url: string; authorization: string | null; body: unknown }[] =
    [];
  globalThis.fetch = async (input, init) => {
    seen.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as unknown,
    });
    return Response.json({ data: { id: "local-fixture" } });
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
      students: [],
      enrollments: [],
      credentials: [],
    };
    const result = await synchronize(snapshot, raes, {
      mode: "base",
      credentialCode: null,
    });
    assert.equal(result.institution, 1);
    assert.equal(result.credentialsCreatedOrReplayed, 0);
    assert.equal(seen.length, 1);
    assert.equal(
      seen[0]?.url,
      `${config.RAES_API_BASE_URL}/api/v1/sync/institution`,
    );
    assert.equal(
      seen[0]?.authorization,
      `Bearer ${config.RAES_UDEA_CLIENT_ID}.${config.RAES_UDEA_CLIENT_SECRET}`,
    );
    assert.equal(
      (seen[0]?.body as { nombre: string }).nombre,
      snapshot.institution.nombre,
    );
  } finally {
    globalThis.fetch = original;
  }
});
