import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

test("oversized constrained arrays stop before validating their elements", () => {
  let inspected = 0;
  const element = z.unknown().superRefine(() => { inspected++; });
  const result = z.array(element).max(2).safeParse(["a", "b", "c"]);
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].code, "too_big");
  assert.equal(inspected, 0, "size rejection must happen before per-element work");
});
