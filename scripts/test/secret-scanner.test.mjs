import test from "node:test";
import assert from "node:assert/strict";
import { findSecretKinds, forbiddenIndexedPath } from "../scan-repository-secrets.mjs";
test("secret scan detects private credentials without returning matched values", () => {
  for (const prefix of ["sbp", "ghp", "sb_secret"]) assert.deepEqual(findSecretKinds([prefix, "a".repeat(48)].join("_")), ["private-api-token"]);
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"), "signature"].join(".");
  assert.deepEqual(findSecretKinds(jwt), ["service-role-jwt"]);
  assert.deepEqual(findSecretKinds("sb_publishable_fixture_only"), []);
  assert.deepEqual(findSecretKinds("sb_secret_not_allowed"), []);
});
test("generated files and private env files are rejected but documented examples remain allowed", () => {
  for (const path of [".env", "apps/a/.env.local", "spa.traineddata", "tests/run.har", "tls.key", "x/.next/static/app.js"]) assert.equal(forbiddenIndexedPath(path), true);
  assert.equal(forbiddenIndexedPath("apps/a/.env.example"), false);
});
