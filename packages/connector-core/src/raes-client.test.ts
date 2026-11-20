import test from "node:test";
import assert from "node:assert/strict";
import { RaesClient, RaesApiError } from "./raes-client";
const client = new RaesClient({ baseUrl: "https://raes.fixture.invalid", clientId: "synthetic", clientSecret: "synthetic-secret", namespace: "synthetic" });
test("connector sanitizes network and upstream errors without reflecting payloads", async () => {
  const original = globalThis.fetch;
  try {
    for (const fetcher of [async () => { throw new Error("PRIVATE_INTERNAL_MARKER"); }, async () => Response.json({ error: "PRIVATE_INTERNAL_MARKER", message: "PRIVATE_INTERNAL_MARKER", details: "PRIVATE_INTERNAL_MARKER" }, { status: 500 })]) {
      globalThis.fetch = fetcher;
      await assert.rejects(client.getCredentialState("synthetic"), error => {
        assert.ok(error instanceof RaesApiError);
        assert.equal(JSON.stringify({ message: error.message, code: error.code, details: error.details }).includes("PRIVATE_INTERNAL_MARKER"), false);
        return true;
      });
    }
  } finally { globalThis.fetch = original; }
});
test("connector rejects malformed state before it can drive any academic mutation", async () => {
  const original = globalThis.fetch;
  try {
    for (const data of [null, { state: "UNKNOWN", version: 1 }, { state: "VIGENTE", version: 1, creationKey: "synthetic", personSourceIds: [], payload: {} }]) {
      globalThis.fetch = async (_, init) => { assert.equal(init?.method, "GET"); return Response.json({ data }); };
      await assert.rejects(client.getCredentialState("synthetic"), error => error instanceof RaesApiError && error.code === "RAES_INVALID_RESPONSE");
    }
    globalThis.fetch = async () => Response.json({ error: "CREDENTIAL_NOT_FOUND" }, { status: 404 });
    assert.equal(await client.getCredentialState("missing"), null);
  } finally { globalThis.fetch = original; }
});

test('proposal admission retry honors a short Retry-After once, preserving payload and correlation',async()=>{
 const {academicObservationSchema}=await import('@raes/contracts');
 const observation=academicObservationSchema.parse({persona:{identificadorOrigen:'synthetic',tipoDocumento:'CC',numeroDocumento:'SYNTHETIC',primerNombre:'Synthetic',segundoNombre:null,primerApellido:'Test',segundoApellido:null},sourceUpdatedAt:null,credenciales:[]});
 const original=globalThis.fetch;let count=0;const bodies:string[]=[];
 globalThis.fetch=async(_input,init)=>{bodies.push(String(init?.body));assert.ok(new Headers(init?.headers).get('X-Request-Id'));return ++count===1?Response.json({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'1'}}):Response.json({data:{observaciones:[]}});};
 try{assert.deepEqual(await client.submitReview('00000000-0000-4000-8000-000000000001',observation),{observaciones:[]});assert.equal(count,2);assert.equal(bodies[0],bodies[1]);}finally{globalThis.fetch=original;}
});
