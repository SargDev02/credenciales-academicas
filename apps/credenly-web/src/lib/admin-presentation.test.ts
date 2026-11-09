import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAdminTimestamp,
  metricBreakdown,
  servicePresentation,
  stateTone,
  validAccountPage,
} from "./admin-presentation";
import type { Health } from "./admin-model";

test("KPI breakdown preserves real zeroes and independent counts without inventing a remainder", () => {
  const rows = metricBreakdown(
    { total: 40, byState: { APROBADA: 0, REVISION: 7, RECHAZADA: 2 } },
    [
      ["APROBADA", "Aprobadas"],
      ["REVISION", "En revisión"],
    ],
  );
  assert.deepEqual(rows, [
    { state: "APROBADA", label: "Aprobadas", value: 0 },
    { state: "REVISION", label: "En revisión", value: 7 },
  ]);
  assert.equal(
    rows.some((row) => row.state === "OTHER"),
    false,
  );
});
const healthy: Health = {
  checkedAt: "2026-10-19T00:10:00Z",
  httpStatus: 200,
  status: "ready",
  components: { database: "up", auth: "up", raes: "up" },
};
test("health reports a real Auth API check without claiming a user login", () => {
  const state = servicePresentation(healthy);
  assert.equal(state.operational, true);
  assert.equal(state.components[1]!.availableLabel, "Disponible");
  assert.match(
    state.components[1]!.description,
    /No simula un inicio de sesión/,
  );
});
test("dependency failure or readiness 503 never renders an operational system", () => {
  for (const data of [
    { ...healthy, httpStatus: 503 },
    { ...healthy, status: "not_ready" as const },
    {
      ...healthy,
      components: { ...healthy.components, raes: "down" as const },
    },
    {
      ...healthy,
      components: { ...healthy.components, auth: "down" as const },
    },
  ])
    assert.equal(servicePresentation(data).operational, false);
});
test("process indicators distinguish pending/review, successful and terminal/rejected states", () => {
  assert.equal(stateTone("REVISION"), "warning");
  assert.equal(stateTone("VERIFICADA"), "success");
  assert.equal(stateTone("REVOCADA"), "danger");
  assert.equal(stateTone("PROCESADA"), "neutral");
  assert.equal(stateTone("UNKNOWN"), "neutral");
});
test("administrative timestamps include Bogotá date/time and do not invent missing access dates", () => {
  const value = formatAdminTimestamp("2026-10-19T00:10:00Z");
  assert.match(value, /18/);
  assert.match(value, /7:10|19:10/);
  assert.equal(formatAdminTimestamp(null), "Sin acceso registrado");
  assert.equal(formatAdminTimestamp("invalid"), "Fecha no disponible");
});
test("account pagination rejects repeated query values, zero and out-of-contract pages", () => {
  for (const value of ["1", "20", "9999"])
    assert.equal(validAccountPage(value), true);
  for (const value of [
    undefined,
    ["1", "2"],
    "0",
    "-1",
    "10000",
    "1.5",
    "01",
    "1&email=private",
  ])
    assert.equal(validAccountPage(value), false);
});
