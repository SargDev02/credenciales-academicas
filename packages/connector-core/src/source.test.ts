import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionSourceClient, readInstitutionalSnapshot } from "./source";

test("la lectura institucional pagina más de 1000 filas sin escribir en la fuente", async () => {
  const original = globalThis.fetch;
  const offsets: number[] = [];
  globalThis.fetch = async (input, init) => {
    assert.ok(!init?.method || init.method === "GET");
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (table === "institucion") return Response.json([{ nit: "fixture" }]);
    if (table === "estudiantes") {
      const offset = Number(url.searchParams.get("offset") ?? 0); offsets.push(offset);
      return Response.json(Array.from({ length: offset === 0 ? 1000 : 1 }, (_, i) => ({ id: String(offset + i) })));
    }
    return Response.json([]);
  };
  try {
    const result = await readInstitutionalSnapshot(createInstitutionSourceClient({ supabaseUrl: "https://source-fixture.supabase.co", serviceRoleKey: "fixture" }));
    assert.equal(result.students.length, 1001); assert.deepEqual(offsets, [0, 1000]);
  } finally { globalThis.fetch = original; }
});
