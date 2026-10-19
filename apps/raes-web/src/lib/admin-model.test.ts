import assert from "node:assert/strict";
import test from "node:test";
import {
  filterRecords,
  isClients,
  isInstitutions,
  statusLabel,
  statusTone,
  formatDate,
} from "./admin-model";
test("render only the actual API shape, never guessed scopes or roles", () => {
  assert.equal(isInstitutions({ data: [{ id: "demo" }] }), false);
  assert.equal(
    isClients({ data: [{ nombre: "demo", scopes: ["invented"] }] }),
    false,
  );
  assert.equal(isClients({ data: [] }), true);
});
test("filters are local and handle accents, empty results and state", () => {
  const rows = [
    { nombre: "Universidad de prueba", estado: "ACTIVA" },
    { nombre: "Instituto de ejemplo", estado: "INACTIVA" },
  ];
  assert.equal(filterRecords(rows, " UNIVERSIDAD ", "").length, 1);
  assert.equal(filterRecords(rows, "", "SUSPENDIDA").length, 0);
  assert.equal(filterRecords(rows, undefined, "INACTIVA").length, 1);
});
test("statuses have labels and terminal state remains visible", () => {
  assert.equal(statusLabel("REVOCADO"), "Revocado");
  assert.equal(statusTone("REVOCADO"), "danger");
  assert.equal(statusLabel("SUSPENDIDO"), "Suspendido");
});
test("date formatting is deterministic and handles no activity", () => {
  assert.equal(formatDate(null), "Sin registro");
  assert.equal(formatDate("invalid"), "Fecha no disponible");
  assert.ok(formatDate("2026-10-18T12:00:00Z").includes("2026"));
});

test("admin profile accepts only active server roles and permissions fail closed", async () => {
  const { isAdminProfile, canManage } = await import("./admin-model");
  const base = { id: "fixture", nombres: "Prueba", apellidos: "Sintética", estado: "ACTIVO" };
  for (const rol of ["SUPERADMIN", "ADMIN", "AUDITOR"] as const) {
    const profile = { ...base, estado: "ACTIVO" as const, rol };
    assert.equal(isAdminProfile({ data: profile }), true);
    assert.equal(canManage(profile), rol !== "AUDITOR");
  }
  for (const data of [{ ...base, rol: "CITIZEN" }, { ...base, rol: "ADMIN", estado: "INACTIVO" }, { user_metadata: { rol: "ADMIN" } }]) {
    assert.equal(isAdminProfile({ data }), false);
  }
});
