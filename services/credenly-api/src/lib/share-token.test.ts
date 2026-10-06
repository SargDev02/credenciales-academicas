import assert from "node:assert/strict";
import test from "node:test";

import {
  generateShareToken,
  getShareTokenPrefix,
  hashAccessIp,
  hashShareToken,
  isValidShareTokenFormat,
} from "./share-token";

test("genera tokens de compartición con formato esperado", () => {
  const token = generateShareToken();

  assert.equal(isValidShareTokenFormat(token), true);
  assert.equal(token.startsWith("crdn_shr_"), true);
});

test("hash de token es SHA-256 estable y no revela el token", () => {
  const token = "crdn_shr_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO";

  const hashA = hashShareToken(token);
  const hashB = hashShareToken(token);

  assert.equal(hashA, hashB);
  assert.equal(hashA.length, 64);
  assert.equal(hashA.includes(token), false);
});

test("prefix permite identificar una compartición sin guardar el token", () => {
  const token = generateShareToken();
  const prefix = getShareTokenPrefix(token);

  assert.equal(prefix.length, 20);
  assert.equal(token.startsWith(prefix), true);
});

test("IP se pseudonimiza con HMAC y material secreto", () => {
  const first = hashAccessIp("127.0.0.1", "secret-one");
  const second = hashAccessIp("127.0.0.1", "secret-one");
  const other = hashAccessIp("127.0.0.1", "secret-two");

  assert.equal(first?.length, 64);
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test("IP ausente no genera hash", () => {
  assert.equal(hashAccessIp(null, "secret"), null);
});
