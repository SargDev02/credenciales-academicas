import assert from "node:assert/strict";
import test from "node:test";

import {
  formatInstitutionBearer,
  generateClientId,
  generateClientSecret,
  getSecretLookupPrefix,
  hashClientSecret,
  parseInstitutionBearer,
  verifyClientSecret,
} from "./api-credentials";

test("genera client id y secreto con prefijos esperados", () => {
  assert.match(generateClientId(), /^raes_cli_[A-Za-z0-9_-]+$/);
  assert.match(generateClientSecret(), /^raes_sk_[A-Za-z0-9_-]+$/);
});

test("genera secretos distintos", () => {
  assert.notEqual(generateClientSecret(), generateClientSecret());
});

test("hash SHA-256 no conserva el secreto en texto plano", () => {
  const secret = generateClientSecret();
  const hash = hashClientSecret(secret);

  assert.equal(hash.length, 64);
  assert.notEqual(hash, secret);
  assert.equal(verifyClientSecret(secret, hash), true);
  assert.equal(verifyClientSecret(`${secret}x`, hash), false);
});

test("serializa y analiza Authorization Bearer institucional", () => {
  const clientId = generateClientId();
  const secret = generateClientSecret();
  const header = formatInstitutionBearer(clientId, secret);

  assert.deepEqual(parseInstitutionBearer(header), {
    clientId,
    secret,
  });
});

test("rechaza formatos Bearer inválidos", () => {
  assert.equal(parseInstitutionBearer(null), null);
  assert.equal(parseInstitutionBearer("Basic abc"), null);
  assert.equal(parseInstitutionBearer("Bearer abc"), null);
  assert.equal(parseInstitutionBearer("Bearer foo.bar"), null);
});

test("el prefijo de búsqueda es estable y no contiene el secreto completo", () => {
  const secret = generateClientSecret();
  const prefix = getSecretLookupPrefix(secret);

  assert.equal(prefix.length, 20);
  assert.equal(secret.startsWith(prefix), true);
  assert.notEqual(prefix, secret);
});
