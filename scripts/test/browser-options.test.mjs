import test from "node:test";
import assert from "node:assert/strict";
import { chromiumOptions } from "../../tests/helpers/browser.mjs";
test("Linux CI never inherits a macOS Chrome path", () => {
  assert.deepEqual(
    chromiumOptions("linux", undefined, () => true),
    { headless: true },
  );
});
test("local Chrome is optional and an explicit executable overrides discovery", () => {
  assert.deepEqual(
    chromiumOptions("darwin", undefined, () => false),
    { headless: true },
  );
  assert.equal(
    chromiumOptions("darwin", undefined, () => true).executablePath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
  assert.equal(
    chromiumOptions("linux", "/fixture/chromium", () => false).executablePath,
    "/fixture/chromium",
  );
});
