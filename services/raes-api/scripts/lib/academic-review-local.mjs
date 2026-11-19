import assert from "node:assert/strict";
import { fixture, baseline, beginDetection, observation, submit, decision, snapshot } from "../../../../scripts/lib/academic-review-fixture.mjs";
import { countTables, verifyIdempotence } from "./academic-review-idempotence.mjs";

// Explicit test mode: only local PostgreSQL/WASM. Never reads .env, Keychain,
// Supabase Auth or a network endpoint. Does not substitute for remote Auth proof.
export async function verifyLocalCompletedReview() {
  const db = await fixture();
  try {
    await baseline(db);
    const lease = await beginDetection(db), value = observation();
    value.credenciales[0].contenido.titulo = "Contenido B sintético local";
    const pending = await submit(db, value, lease);
    const request = pending.observaciones.find(row => row.nueva).id;
    await decision(db, request);
    const before = await snapshot(db), trace = [];
    const counts = async () => {
      const result = {};
      for (const table of countTables) result[table] = (await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
      return result;
    };
    const result = await verifyIdempotence({ counts,
      detect: async () => {
        const detected = await submit(db, value, lease);
        return { operation: "DETECT_AND_SUBMIT", studentsObserved: 1, credentialsObserved: 1,
          proposalsCreated: detected.observaciones.filter(row => row.nueva).length,
          observationsUnchanged: detected.observaciones.filter(row => !row.nueva).length, canonicalWrites: 0 };
      },
      replay: async () => {
        await db.exec("begin;set local role service_role");
        try { return await decision(db, request); }
        finally { await db.exec("rollback"); }
      },
      record: (name, data) => trace.push({name, data}),
    });
    assert.deepEqual(await snapshot(db), before);
    return { result: "PASS", mode: "LOCAL_WASM", remoteRequests: 0, remoteAuthChecked: false,
      canonicalRowsUnchanged: true, canonicalWrites: result.detection.canonicalWrites,
      replayed: result.replay.replayed, trace };
  } finally { await db.close(); }
}
