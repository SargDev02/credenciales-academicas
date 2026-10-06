import assert from "node:assert/strict";
import test from "node:test";

import { buildRaesAuthorization } from "./raes-client";

test("construye Authorization de servicio Credenly -> RAES", () => {
  const header = buildRaesAuthorization(
    "raes_cli_test",
    "raes_sk_test",
  );

  assert.equal(
    header,
    "Bearer raes_cli_test.raes_sk_test",
  );
});
