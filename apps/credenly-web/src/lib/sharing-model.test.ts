import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareShare,
  isShares,
  isCreatedShare,
  validShareToken,
  publicError,
  isPublicVerification,
} from "./sharing-model";
function form(hours: string, fields: string[] = []) {
  const value = new FormData();
  value.set("raesCredencialId", "00000000-0000-4000-8000-000000000001");
  value.set("expiresInHours", hours);
  for (const field of fields) value.append("camposVisibles", field);
  return value;
}
test("share form enforces backend duration and visible-field allowlist", () => {
  assert.deepEqual(
    prepareShare(form("1", ["programa", "motivoEstado"])).camposVisibles,
    ["programa", "motivoEstado"],
  );
  assert.equal(prepareShare(form("720")).expiresInHours, 720);
  for (const hours of ["0", "721", "NaN", "2.5", ""])
    assert.throws(() => prepareShare(form(hours)));
  assert.throws(() => prepareShare(form("24", ["usuario_id"])));
});
test("listed shares have no recoverable token and creation requires a one-time token", () => {
  const share = {
    id: "fixture",
    raesCredencialId: "credential",
    tokenPrefix: "prefix",
    camposVisibles: [],
    expiresAt: "2026-11-01",
    revokedAt: null,
    estado: "ACTIVA",
    createdAt: "2026-10-18",
  };
  assert.equal(isShares({ data: [share] }), true);
  assert.equal(isCreatedShare({ data: share }), false);
  assert.equal(
    isCreatedShare({
      data: {
        ...share,
        token: `crdn_shr_${"a".repeat(43)}`,
        tokenReturnedOnce: true,
      },
    }),
    true,
  );
  for (const value of ["/../../private", "not-a-token", "crdn_shr_short"])
    assert.equal(validShareToken(value), false);
});
test("public API statuses distinguish revoked, expired, unavailable and sanitized failure", () => {
  assert.equal(publicError(410, "SHARE_REVOKED").title, "Enlace revocado");
  assert.equal(publicError(410, "SHARE_EXPIRED").title, "Enlace expirado");
  assert.equal(
    publicError(404, "CREDENTIAL_NOT_AVAILABLE").title,
    "Información no disponible",
  );
  assert.equal(
    publicError(500, "private detail").message.includes("private"),
    false,
  );
});
test("public projection accepts terminal states and rejects stored/malformed payloads", () => {
  const payload = {
    data: {
      share: { id: "fixture", expiresAt: "2026-11-01" },
      credential: {
        codigoRaes: "SYNTH-LOCAL",
        tipo: "DIPLOMA",
        categoria: "Prueba",
        estadoActual: "REVOCADA",
        versionActual: 2,
        institucion: { nombre: "Institución sintética local", nit: "SYNTH" },
        titulo: "Prueba",
        fechaEmision: "2026-10-18",
        fechaEstadoTerminal: "2026-10-18",
        motivoEstado: "Prueba local",
      },
      source: "RAES",
      persistedByCredenly: false,
      verifiedAt: "2026-10-18",
    },
  };
  assert.equal(isPublicVerification(payload), true);
  assert.equal(
    isPublicVerification({
      data: { ...payload.data, persistedByCredenly: true },
    }),
    false,
  );
  assert.equal(
    isPublicVerification({
      data: {
        ...payload.data,
        credential: { ...payload.data.credential, programa: "malformed" },
      },
    }),
    false,
  );
});
