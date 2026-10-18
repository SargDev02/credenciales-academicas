import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { parseJsonBody } from "./request-validation";
import { ApiError } from "./api-error";
const schema = z.object({ name: z.string().max(20) });
for (const body of ["{", "", JSON.stringify({ name: "x".repeat(21) })]) test(`JSON inválido es 400 sin reflejar entradas (${body.length})`, async () => {
  await assert.rejects(parseJsonBody(new Request("http://localhost", { method: "POST", body }), schema), e => e instanceof ApiError && e.status === 400 && !e.message.includes("xxx"));
});
test("límite JSON se aplica al stream aunque Content-Length mienta", async () => {
  await assert.rejects(parseJsonBody(new Request("http://localhost", { method: "POST", headers: { "content-length": "1" }, body: "x".repeat(65537) }), schema), e => e instanceof ApiError && e.status === 413);
});
test("JSON válido mantiene el contrato y descarta campos no permitidos", async () => {
  assert.deepEqual(await parseJsonBody(new Request("http://localhost", { method: "POST", body: JSON.stringify({ name: "valid", estado: "privileged" }) }), schema), { name: "valid" });
});

test("errores de dominio conservan error y message sin detalles internos", async () => {
  const { apiErrorResponse } = await import("./api-error");
  const response = apiErrorResponse(new ApiError(400, "INVALID_JSON", "JSON inválido"));
  assert.deepEqual(await response.json(), { error: "INVALID_JSON", message: "JSON inválido" });
});
