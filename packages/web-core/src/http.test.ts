import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest, WebApiError, safeReturnPath } from "./http";
import { readWebConfig } from "./config";
test("structured query parameters are encoded without changing the endpoint or leaking authorization", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/v1/admin/users");
    assert.equal(url.searchParams.get("page"), "2&notAnotherParameter=secret");
    assert.equal(url.searchParams.has("notAnotherParameter"), false);
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer local-only",
    );
    return Response.json({ data: [] });
  };
  try {
    await apiRequest("https://api.example", "/api/v1/admin/users", {
      token: "local-only",
      query: { page: "2&notAnotherParameter=secret" },
      validate: valid,
    });
  } finally {
    globalThis.fetch = original;
  }
});
const valid = (v: unknown): v is { data: string[] } =>
  !!v &&
  typeof v === "object" &&
  "data" in v &&
  Array.isArray(v.data) &&
  v.data.every((x) => typeof x === "string");
test("typed request disables caches/redirects and keeps JWT in its authorization header", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.example/api/v1/items");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-only",
    );
    return Response.json({ data: ["item"] });
  };
  try {
    assert.deepEqual(
      await apiRequest("https://api.example", "/api/v1/items", {
        token: "test-only",
        validate: valid,
      }),
      { data: ["item"] },
    );
  } finally {
    globalThis.fetch = orig;
  }
});
for (const status of [401, 403, 404, 500])
  test(`API ${status} is sanitized`, async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      Response.json({ message: "private SQL and secret" }, { status });
    try {
      await assert.rejects(
        apiRequest("https://api.example", "/api/v1/items", {
          token: "test-only",
          validate: valid,
        }),
        (e) =>
          e instanceof WebApiError &&
          e.status === status &&
          !e.message.includes("SQL"),
      );
    } finally {
      globalThis.fetch = orig;
    }
  });
test("invalid payload fails before rendering", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [null] });
  try {
    await assert.rejects(
      apiRequest("https://api.example", "/api/v1/items", {
        token: "test-only",
        validate: valid,
      }),
      (e) => e instanceof WebApiError && e.code === "INVALID_RESPONSE",
    );
  } finally {
    globalThis.fetch = orig;
  }
});
test("caller cancellation is supported without automatic retry", async () => {
  const orig = globalThis.fetch;
  const c = new AbortController();
  c.abort();
  let calls = 0;
  globalThis.fetch = async (_i, init) => {
    calls++;
    init?.signal?.throwIfAborted();
    throw Error();
  };
  try {
    await assert.rejects(
      apiRequest("https://api.example", "/api/v1/items", {
        token: "test-only",
        signal: c.signal,
        validate: valid,
      }),
      (e) => e instanceof WebApiError && e.code === "ABORTED",
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = orig;
  }
});
test("redirect destinations cannot leave the app", () => {
  for (const p of [
    "//evil.example",
    "https://evil.example",
    "/\\evil.example",
    "/\nmalformed",
  ])
    assert.equal(safeReturnPath(p), "/dashboard");
  assert.equal(safeReturnPath("/institutions"), "/institutions");
});
test("app config rejects service keys and isolates cookies", () => {
  const env = {
    RAES_WEB_SUPABASE_URL: "https://raes.example",
    RAES_WEB_SUPABASE_PUBLISHABLE_KEY: "sb_secret_not_allowed",
    RAES_API_BASE_URL: "http://localhost:3001",
  };
  assert.throws(() => readWebConfig(env, "RAES"), /publishable/);
  env.RAES_WEB_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  assert.equal(readWebConfig(env, "RAES").cookieName, "raes-web-auth");
});

test("slow requests time out once with a sanitized error", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () => resolve(Response.json({ data: [] })),
        1000,
      );
      init?.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(init.signal?.reason);
        },
        { once: true },
      );
    });
  };
  try {
    await assert.rejects(
      apiRequest("https://api.example", "/api/v1/items", {
        token: "test-only",
        validate: valid,
        timeoutMs: 5,
      }),
      (error) =>
        error instanceof WebApiError &&
        error.code === "TIMEOUT" &&
        error.status === 504,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("POST uses JSON and never retries an uncertain mutation", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.equal(
      new Headers(init?.headers).get("Content-Type"),
      "application/json",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), { nombre: "Sintético" });
    return Response.json({ message: "internal detail" }, { status: 500 });
  };
  try {
    await assert.rejects(
      apiRequest("https://api.example", "/api/v1/items", {
        token: "fixture",
        method: "POST",
        body: { nombre: "Sintético" },
        validate: valid,
      }),
      (e) => e instanceof WebApiError && e.status === 500,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("document uploads preserve multipart boundaries and the authenticated PUT path is supported", async () => {
  const original = globalThis.fetch;
  const body = new FormData();
  body.set(
    "documento",
    new Blob(["synthetic"], { type: "image/png" }),
    "synthetic.png",
  );
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.body, body);
    assert.equal(new Headers(init?.headers).has("content-type"), false);
    return Response.json({ data: [] });
  };
  try {
    await apiRequest("https://api.example", "/api/v1/identity-verifications", {
      token: "fixture",
      method: "POST",
      body,
      validate: valid,
    });
  } finally {
    globalThis.fetch = original;
  }
});
test("public requests omit Authorization and preserve only known error codes", async () => {
  const original = globalThis.fetch;
  for (const code of [
    "SHARE_EXPIRED",
    "SHARE_REVOKED",
    "secret-private-detail",
  ]) {
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      return Response.json(
        { error: code, message: "private detail" },
        { status: 410 },
      );
    };
    try {
      await assert.rejects(
        apiRequest("https://api.example", "/api/v1/public/shares/fixture", {
          validate: valid,
        }),
        (e) =>
          e instanceof WebApiError &&
          e.status === 410 &&
          e.code === (code.startsWith("SHARE_") ? code : "API_REQUEST_FAILED"),
      );
    } finally {
      globalThis.fetch = original;
    }
  }
});


test("restricted citizen code survives sanitization without exposing upstream details", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "CITIZEN_ACCOUNT_RESTRICTED", message: "private SQL marker" }, { status: 403 });
  try {
    await assert.rejects(apiRequest("https://api.example", "/api/v1/auth/me", { validate: valid }), error => error instanceof WebApiError && error.status === 403 && error.code === "CITIZEN_ACCOUNT_RESTRICTED" && !error.message.includes("SQL"));
  } finally { globalThis.fetch = original; }
});
