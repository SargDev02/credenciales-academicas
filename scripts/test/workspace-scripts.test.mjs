import test from "node:test";
import assert from "node:assert/strict";
import {
  criticalWorkspaces,
  validateWorkspaces,
} from "../check-workspace-scripts.mjs";
const complete = () =>
  criticalWorkspaces.map((name) => ({
    name,
    scripts: {
      test: "node --test",
      typecheck: "tsc --noEmit",
      lint: "eslint .",
    },
  }));
test("every critical workspace is represented, including UdeA", () => {
  assert.deepEqual(validateWorkspaces(complete()), []);
  assert.match(
    validateWorkspaces(
      complete().filter((p) => p.name !== "@raes/connector-udea"),
    ).join(),
    /@raes\/connector-udea/,
  );
});
test("missing tests and no-op scripts fail the gate instead of being skipped", () => {
  const manifests = complete();
  delete manifests[0].scripts.test;
  manifests[1].scripts.lint = "echo skipped";
  assert.equal(validateWorkspaces(manifests).length, 2);
});
