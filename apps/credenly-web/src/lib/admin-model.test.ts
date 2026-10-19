import assert from "node:assert/strict";
import test from "node:test";
import {
  adminCookieName,
  adminReturnPath,
  isAdminProfile,
  isAuthAccounts,
  isHealth,
  isOverview,
  sectionStates,
} from "./admin-model";

test("administrative profile requires an active explicit role, independent of email or metadata", () => {
  const profile = {
    id: "local-only",
    nombres: "Sintético",
    apellidos: "QA",
    rol: "ADMIN_CREDENLY",
    estado: "ACTIVO",
  };
  assert.equal(isAdminProfile({ data: profile }), true);
  for (const invalid of [
    { ...profile, estado: "INACTIVO" },
    { ...profile, rol: "ADMIN" },
    { email: "admin@example.invalid", user_metadata: profile },
  ])
    assert.equal(isAdminProfile({ data: invalid }), false);
});
test("administrative redirects and cookie namespace stay separate from the citizen flow", () => {
  assert.notEqual(adminCookieName, "credenly-web-auth");
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/verifications",
    "/admin/links",
    "/admin/shares",
    "/admin/health",
  ])
    assert.equal(adminReturnPath(path), path);
  for (const path of [
    "//evil.invalid",
    "https://evil.invalid",
    "/credentials",
    "/admin/login",
    "/admin/../credentials",
    "/admin/users?token=private",
    null,
  ])
    assert.equal(adminReturnPath(path), "/admin");
});
test("operational response rejects missing metrics, invented states and unrecognized incident sources", () => {
  const counts = (key: string) => ({
    total: 0,
    byState: Object.fromEntries(
      Object.keys(sectionStates[key]!.labels).map((state) => [state, 0]),
    ),
  });
  const data = {
    observedAt: "2026-10-18T12:00:00Z",
    profiles: counts("profiles"),
    verifications: counts("verifications"),
    links: counts("links"),
    shares: counts("shares"),
    incidents: [],
    incidentSource: "auditoria_admin",
  };
  assert.equal(isOverview({ data }), true);
  assert.equal(
    isOverview({ data: { ...data, shares: { total: 0, byState: {} } } }),
    false,
  );
  assert.equal(
    isOverview({ data: { ...data, profiles: { total: -1, byState: {} } } }),
    false,
  );
  assert.equal(
    isOverview({ data: { ...data, incidentSource: "invented" } }),
    false,
  );
});
test("account pagination and health distinguish explicit API results from unavailable data", () => {
  assert.equal(
    isAuthAccounts({
      data: { page: 1, pageSize: 20, hasMore: false, items: [] },
    }),
    true,
  );
  assert.equal(
    isAuthAccounts({
      data: { page: 0, pageSize: 20, hasMore: false, items: [] },
    }),
    false,
  );
  const health = {
    checkedAt: "2026-10-18T12:00:00Z",
    httpStatus: 503,
    status: "not_ready",
    components: { database: "down", auth: "configured", raes: "down" },
  };
  assert.equal(isHealth({ data: health }), true);
  assert.equal(
    isHealth({
      data: { ...health, components: { ...health.components, auth: "up" } },
    }),
    false,
  );
});
