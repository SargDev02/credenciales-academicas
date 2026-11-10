import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAudit } from "../audit-dependencies.mjs";
const exception = {
  ghsa: "GHSA-fixture",
  module: "fixture",
  version: "1.0.0",
  path: ".>lint>fixture",
  expiresAt: "2026-11-18T23:59:59-05:00",
};
const report = (path = exception.path, version = exception.version) => ({
  metadata: { vulnerabilities: { high: 1 } },
  advisories: {
    one: {
      url: "https://github.com/advisories/GHSA-fixture",
      module_name: "fixture",
      severity: "high",
      findings: [{ version, paths: [path] }],
    },
  },
});
const now = Date.parse("2026-10-19T00:00:00-05:00");
test("only the owner's exact temporary dev path/version exception can pass", () => {
  assert.equal(
    evaluateAudit(report(), [exception], now).status,
    "PASS_WITH_DOCUMENTED_LIMIT",
  );
  assert.equal(
    evaluateAudit(report(".>runtime>fixture"), [exception], now).status,
    "BLOCKED",
  );
  assert.equal(
    evaluateAudit(report(exception.path, "2.0.0"), [exception], now).status,
    "BLOCKED",
  );
});
test("expiry, another advisory or an additional runtime path blocks the gate", () => {
  assert.equal(
    evaluateAudit(report(), [exception], Date.parse("2026-11-20")).status,
    "BLOCKED",
  );
  const another = report();
  another.advisories.one.url = "https://github.com/advisories/GHSA-other";
  assert.equal(evaluateAudit(another, [exception], now).status, "BLOCKED");
  const extra = report();
  extra.advisories.one.findings[0].paths.push(".>runtime>fixture");
  assert.equal(evaluateAudit(extra, [exception], now).status, "BLOCKED");
});
test("an unavailable or incomplete audit never passes as zero vulnerabilities", () => {
  assert.throws(() => evaluateAudit({}, [], now));
  assert.throws(() =>
    evaluateAudit(
      { metadata: { vulnerabilities: { high: 1 } }, advisories: {} },
      [],
      now,
    ),
  );
  assert.equal(
    evaluateAudit(
      { metadata: { vulnerabilities: { high: 0 } }, advisories: {} },
      [],
      now,
    ).status,
    "PASS",
  );
});
