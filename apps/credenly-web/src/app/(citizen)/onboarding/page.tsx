import Link from "next/link";
import { Alert, Card, PageHeading, buttonClass } from "@raes/ui";
import {
  getProfile,
  getVerification,
  getRaesLink,
} from "../../../lib/citizen-api";
import { onboardingStep } from "../../../lib/citizen-model";
import { OnboardingForm } from "../../../components/onboarding-form";
import { CredentialStatus } from "../../../components/credential-status";
export const metadata = { title: "Tu perfil y vinculación" };
export default async function Onboarding() {
  const [profile, verification, link] = await Promise.all([
    getProfile(),
    getVerification(),
    getRaesLink(),
  ]);
  const step = onboardingStep(profile, verification, link);
  return (
    <>
      <PageHeading eyebrow="PASO A PASO" title="Conecta tu historia académica">
        Completa tu perfil, verifica el documento y vincula tu identidad con
        RAES.
      </PageHeading>
      <ol className="onboarding-progress" aria-label="Progreso de tu cuenta">
        {[
          "Cuenta",
          "Perfil",
          "Documento",
          "Verificación",
          "Vinculación",
          "Credenciales",
        ].map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            <span aria-hidden="true">{index < step ? "✓" : index + 1}</span>
            {label}
            <span className="ui-visually-hidden">
              {index < step
                ? ": completado"
                : index === step
                  ? ": paso actual"
                  : ": pendiente"}
            </span>
          </li>
        ))}
      </ol>
      <div className="onboarding-grid">
        <Card>
          <h2>Tu perfil</h2>
          <p className="ui-muted">
            Usa los nombres que aparecen en tu documento.
          </p>
          <OnboardingForm
            kind="profile"
            names={profile ?? { nombres: null, apellidos: null }}
          />
        </Card>
        <Card>
          <h2>Verificación documental</h2>
          <Alert title="Sobre este proceso">
            La lectura del documento ayuda a vincular tu identidad. Su
            aprobación no garantiza la autenticidad legal del documento ni
            equivale a KYC.
          </Alert>
          {verification && (
            <div className="verification-result">
              <CredentialStatus state={verification.estado} />
              <p>
                {verification.tipoDocumento ?? "Documento"} ·{" "}
                {verification.numeroDocumento ?? "Número no identificado"}
              </p>
              {verification.motivoFallo && <p>{verification.motivoFallo}</p>}
              {verification.motivoRevision && (
                <p>{verification.motivoRevision}</p>
              )}
              {verification.estado === "REVISION" && (
                <p>
                  Tu documento necesita revisión. No podemos vincularlo mientras
                  no esté aprobado.
                </p>
              )}
              {["PENDIENTE", "PROCESADA"].includes(verification.estado) && (
                <Link href="/onboarding">Actualizar estado</Link>
              )}
            </div>
          )}
          {step >= 2 ? (
            <OnboardingForm kind="document" />
          ) : (
            <p>Guarda tu perfil para enviar el documento.</p>
          )}
        </Card>
        <Card>
          <h2>Vinculación con RAES</h2>
          {link?.estado === "VERIFICADA" ? (
            <>
              <Alert title="Identidad vinculada" tone="success">
                Ya puedes consultar tus credenciales.
              </Alert>
              <Link className={buttonClass()} href="/credentials">
                Ir a mis credenciales
              </Link>
            </>
          ) : verification?.estado === "APROBADA" &&
            verification.canLinkRaes ? (
            <>
              <p>
                Vincula la identidad del documento aprobado para consultar las
                credenciales que RAES tenga asociadas.
              </p>
              <OnboardingForm kind="link" verificationId={verification.id} />
            </>
          ) : (
            <p>
              La verificación documental debe estar aprobada para vincular tu
              cuenta.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
