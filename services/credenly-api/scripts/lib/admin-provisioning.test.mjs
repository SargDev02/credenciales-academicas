import test from "node:test";
import assert from "node:assert/strict";
import {
  assertEmailAvailable,
  listAuthUsers,
  provisionAdmin,
  validatePassword,
} from "./admin-provisioning.mjs";
const id = "10000000-0000-4000-8000-000000000001";
function fixture() {
  const calls = [];
  let profile = null,
    present = false;
  const user = {
    id,
    email: "operator@fixture.invalid",
    email_confirmed_at: "2026-10-19T00:00:00Z",
  };
  const auth = {
    async createUser(data) {
      calls.push(["create", Object.keys(data)]);
      present = true;
      return { data: { user } };
    },
    async getUserById() {
      return present ? { data: { user } } : { error: { status: 404 } };
    },
    async deleteUser(value) {
      calls.push(["delete", value]);
      present = false;
      return {};
    },
  };
  const profiles = {
    async assertNoCitizenRelations(value) {
      calls.push(["noCitizen", value]);
    },
    async insert(value) {
      calls.push(["insert", value.id]);
      profile = value;
    },
    async find() {
      return profile;
    },
  };
  return {
    calls,
    auth,
    profiles,
    user,
    input: {
      auth,
      profiles,
      email: user.email,
      nombres: "Operador",
      apellidos: "Sintético",
      password: "local-fixture-only-password",
      previousIds: new Set(),
    },
  };
}
test("password policy and confirmation abort invalid input without exposing it", () => {
  for (const [a, b] of [
    ["short", "short"],
    ["long-local-fixture", "different"],
    [" ".repeat(12), " ".repeat(12)],
  ])
    assert.throws(() => validatePassword(a, b));
  assert.doesNotThrow(() =>
    validatePassword(
      "local-fixture-only-password",
      "local-fixture-only-password",
    ),
  );
});
test("case-insensitive collisions abort without adopting an existing identity", () => {
  assert.throws(() =>
    assertEmailAvailable(
      [{ email: "OPERATOR@fixture.invalid" }],
      "operator@fixture.invalid",
    ),
  );
});
test("Auth inventory follows pagination and fails closed on partial results", async () => {
  const pages = [];
  assert.equal(
    (
      await listAuthUsers({
        async listUsers({ page }) {
          pages.push(page);
          return {
            data: {
              users:
                page === 1
                  ? Array.from({ length: 100 }, () => ({ id: "fixture" }))
                  : [],
            },
          };
        },
      })
    ).length,
    100,
  );
  assert.deepEqual(pages, [1, 2]);
  await assert.rejects(
    listAuthUsers({
      async listUsers() {
        return { error: {} };
      },
    }),
  );
});
test("successful provisioning writes only the new administrative profile", async () => {
  const f = fixture();
  const result = await provisionAdmin(f.input);
  assert.deepEqual(result, {
    id,
    nombres: "Operador",
    apellidos: "Sintético",
    rol: "ADMIN_CREDENLY",
    estado: "ACTIVO",
  });
  assert.equal(f.calls.filter(([action]) => action === "delete").length, 0);
  assert.deepEqual(f.calls[0], [
    "create",
    ["email", "password", "email_confirm"],
  ]);
});
test("a returned preexisting UUID is never adopted or deleted", async () => {
  const f = fixture();
  f.input.previousIds.add(id);
  await assert.rejects(provisionAdmin(f.input));
  assert.equal(f.calls.length, 1);
});
test("profile failure compensates only its proven new Auth identity and verifies 404", async () => {
  const f = fixture();
  f.profiles.insert = async () => {
    throw Error("fixture");
  };
  await assert.rejects(
    provisionAdmin(f.input),
    (e) => e.details.compensation === "AUTH_REMOVED_VERIFIED",
  );
  assert.deepEqual(
    f.calls.filter(([action]) => action === "delete"),
    [["delete", id]],
  );
});
test("ambiguous committed profile stops without forcing a foreign key deletion", async () => {
  const f = fixture();
  f.profiles.insert = async () => {
    throw Error("fixture");
  };
  f.profiles.find = async () => ({ id });
  await assert.rejects(
    provisionAdmin(f.input),
    (e) => e.details.compensation === "REQUIRES_REVIEW",
  );
  assert.equal(f.calls.filter(([action]) => action === "delete").length, 0);
});
test("failed cleanup is reported and never retried blindly", async () => {
  const f = fixture();
  f.profiles.insert = async () => {
    throw Error("fixture");
  };
  f.auth.deleteUser = async () => {
    f.calls.push(["delete", id]);
    return { error: {} };
  };
  await assert.rejects(
    provisionAdmin(f.input),
    (e) => e.details.compensation === "FAILED",
  );
  assert.equal(f.calls.filter(([action]) => action === "delete").length, 1);
});
test("unexpected citizen relations stop compensation without deleting Auth", async () => {
  const f = fixture();
  f.profiles.assertNoCitizenRelations = async () => {
    throw Error("fixture");
  };
  await assert.rejects(
    provisionAdmin(f.input),
    (e) =>
      e.details.createdId === id &&
      e.details.compensation === "REQUIRES_REVIEW",
  );
  assert.equal(f.calls.filter(([action]) => action === "delete").length, 0);
});
