import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CredentialCard,
  EmptyState,
  PageHeading,
  buttonClass,
} from "@raes/ui";
import { getCredentials, getRaesLink } from "../../../lib/citizen-api";
import { date } from "../../../lib/citizen-model";
import { CredentialStatus } from "../../../components/credential-status";
export const metadata = { title: "Mis credenciales" };
export default async function Credentials() {
  if ((await getRaesLink())?.estado !== "VERIFICADA") redirect("/onboarding");
  const credentials = await getCredentials();
  return (
    <>
      <PageHeading eyebrow="TU TRAYECTORIA ACADÉMICA" title="Mis credenciales">
        Tus logros, consultados directamente desde RAES.
      </PageHeading>
      <p className="live-note">
        Información consultada desde RAES · Credenly no almacena tus
        credenciales.
      </p>
      {credentials.length ? (
        <div className="credential-grid">
          {credentials.map((c) => (
            <CredentialCard
              key={c.id}
              category={c.categoria}
              title={c.version?.titulo ?? c.tipo}
              institution={c.institucion?.nombre ?? "Institución no informada"}
              issuedAt={date(c.version?.fechaEmision)}
              status={<CredentialStatus state={c.estadoActual} />}
              actions={
                <>
                  <Link
                    href={`/credentials/${encodeURIComponent(c.id)}`}
                    className={buttonClass("secondary")}
                  >
                    Ver detalle
                    <span className="ui-visually-hidden">
                      {" "}
                      de {c.version?.titulo ?? c.codigoRaes}
                    </span>
                  </Link>
                  <Link href={`/shares?credential=${encodeURIComponent(c.id)}`}>
                    Compartir
                    <span className="ui-visually-hidden">
                      {" "}
                      {c.version?.titulo ?? c.codigoRaes}
                    </span>
                  </Link>
                </>
              }
            >
              <p className="ui-muted">
                {[c.programa?.nombre, c.sede?.nombre]
                  .filter(Boolean)
                  .join(" · ") || "Programa y sede no informados"}
              </p>
            </CredentialCard>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="Aún no hay credenciales">
            Tu identidad está vinculada. Aquí aparecerán las credenciales que
            las instituciones reporten a RAES.
          </EmptyState>
        </Card>
      )}
    </>
  );
}
