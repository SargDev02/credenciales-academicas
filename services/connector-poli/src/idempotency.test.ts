import assert from "node:assert/strict";
import test from "node:test";

import { stableKey } from "./idempotency";

test("la clave de registro permanece estable para el mismo origen", () => {
  assert.equal(
    stableKey("create", "credential-1"),
    stableKey("create", "credential-1"),
  );
});

test("una corrección distinta obtiene una clave distinta", () => {
  const first = stableKey("correct", "credential-1", {
    numeroActa: "1",
  });
  const second = stableKey("correct", "credential-1", {
    numeroActa: "2",
  });

  assert.notEqual(first, second);
  assert.ok(first.length <= 200);
  assert.ok(second.length <= 200);
});
