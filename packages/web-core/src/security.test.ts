import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders, webContentSecurityPolicy, LocalRequestLimiter, apiRequestLimit } from "./security";
test("production CSP blocks framing, external connections, inline scripts and eval", () => {
  const csp = webContentSecurityPolicy("unpredictableTestNonce", false);
  assert.match(csp, /script-src 'self' 'nonce-unpredictableTestNonce' 'strict-dynamic';/);
  assert.match(csp, /connect-src 'self';/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.throws(() => webContentSecurityPolicy("bad'; script-src *", false));
  assert.match(webContentSecurityPolicy("devNonce", true), /unsafe-eval/);
  assert.equal(securityHeaders(true).find(h => h.key === "Strict-Transport-Security")?.value, "max-age=31536000");
  assert.equal(securityHeaders(false).some(h => h.key === "Strict-Transport-Security"), false);
});
test("fixed windows reject excess work, do not extend on rejection and recover after expiry", () => {
  const limiter = new LocalRequestLimiter();
  const policy = { bucket: "test", limit: 2, windowMs: 60_000 };
  assert.equal(limiter.consume(policy, 0).allowed, true);
  assert.equal(limiter.consume(policy, 1).allowed, true);
  assert.deepEqual(limiter.consume(policy, 20_000), { allowed: false, retryAfter: 40 });
  assert.equal(limiter.consume(policy, 60_000).allowed, true);
});
test("sensitive endpoint classes get bounded independent buckets without token/IP keys", () => {
  assert.equal(apiRequestLimit("/api/v1/identity-verifications", "POST").limit, 6);
  assert.equal(apiRequestLimit("/api/v1/identity-verifications", "GET").bucket, "api");
  assert.equal(apiRequestLimit("/api/v1/public/shares/synthetic", "GET").limit, 120);
  assert.equal(apiRequestLimit("/api/v1/admin/institutions", "POST").limit, 20);
  for (const path of ["/api/v1/persons/resolve", "/api/v1/credentials", "/api/v1/sync/persons", "/api/v1/admin/me"]) assert.equal(apiRequestLimit(path, "GET").limit, 600);
  const limiter = new LocalRequestLimiter(1);
  assert.equal(limiter.consume({ bucket: "first", limit: 1, windowMs: 1000 }, 0).allowed, true);
  assert.equal(limiter.consume({ bucket: "unbounded-client-key", limit: 1, windowMs: 1000 }, 1).allowed, false);
  assert.equal(limiter.consume({ bucket: "later", limit: 1, windowMs: 1000 }, 1000).allowed, true);
});
