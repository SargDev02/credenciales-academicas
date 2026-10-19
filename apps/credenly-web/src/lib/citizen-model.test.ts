import assert from "node:assert/strict";
import test from "node:test";
import {
  isProfile,
  isVerification,
  isLink,
  isCredentials,
  onboardingStep,
  statusText,
  type Verification,
  type Profile,
  type RaesLink,
} from "./citizen-model";
const profile: Profile = {
  id: "fixture",
  nombres: "Prueba",
  apellidos: "Sintética",
  estado: "ACTIVO",
};
const verification: Verification = {
  id: "verification",
  tipoDocumento: "CC",
  numeroDocumento: "SYNTH-ONLY",
  nombres: "Prueba",
  apellidos: "Sintética",
  estado: "APROBADA",
  motivoFallo: null,
  motivoRevision: null,
  canLinkRaes: true,
};
const link: RaesLink = {
  id: "link",
  raesPersonaId: "person",
  verificacionIdentidadId: "verification",
  estado: "VERIFICADA",
};
test("onboarding advances from server profile/document/approval/link, never guessed identity", () => {
  assert.equal(onboardingStep(null, null, null), 1);
  assert.equal(onboardingStep(profile, null, null), 2);
  for (const estado of [
    "PENDIENTE",
    "PROCESADA",
    "REVISION",
    "RECHAZADA",
  ] as const)
    assert.equal(onboardingStep(profile, { ...verification, estado }, null), 3);
  assert.equal(onboardingStep(profile, verification, null), 4);
  assert.equal(onboardingStep(profile, verification, link), 5);
});
test("citizen model rejects unrecognized verification/link responses", () => {
  assert.equal(isProfile({ data: null }), true);
  assert.equal(isProfile({ data: profile }), true);
  assert.equal(isVerification({ data: verification }), true);
  assert.equal(
    isVerification({ data: { ...verification, estado: "AUTHENTIC_LEGAL" } }),
    false,
  );
  assert.equal(isLink({ data: link }), true);
  assert.equal(isLink({ data: { ...link, estado: "invented" } }), false);
});
test("academic responses must come from RAES without Credenly persistence", () => {
  assert.equal(
    isCredentials({ data: [], source: "RAES", persistedByCredenly: false }),
    true,
  );
  assert.equal(
    isCredentials({ data: [], source: "MOCK", persistedByCredenly: false }),
    false,
  );
  assert.equal(
    isCredentials({ data: [], source: "RAES", persistedByCredenly: true }),
    false,
  );
  assert.equal(
    isCredentials({
      data: [{ id: "malformed" }],
      source: "RAES",
      persistedByCredenly: false,
    }),
    false,
  );
});
test("terminal academic and document states retain distinct labels", () => {
  assert.equal(statusText("REVOCADA"), "Revocada");
  assert.equal(statusText("ANULADA"), "Anulada");
  assert.equal(statusText("REVISION"), "En revisión");
});
