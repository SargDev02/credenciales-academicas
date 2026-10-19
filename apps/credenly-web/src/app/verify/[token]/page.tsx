import Link from "next/link";
import { Alert, Card, PageHeading } from "@raes/ui";
import { apiRequest, WebApiError } from "@raes/web-core";
import { getWebConfig } from "../../../lib/env";
import {
  isPublicVerification,
  validShareToken,
  publicError,
  type PublicVerification,
} from "../../../lib/sharing-model";
import { date } from "../../../lib/citizen-model";
import { CredentialStatus } from "../../../components/credential-status";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Verificación pública",
  robots: { index: false, follow: false },
};
export default async function Verify({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data: PublicVerification | undefined;
  let error: ReturnType<typeof publicError> | undefined;
  if (!validShareToken(token)) error = publicError(404, "");
  else
    try {
      data = (
        await apiRequest(
          getWebConfig().apiBase,
          `/api/v1/public/shares/${encodeURIComponent(token)}`,
          { validate: isPublicVerification },
        )
      ).data;
    } catch (e) {
      error =
        e instanceof WebApiError
          ? publicError(e.status, e.code)
          : publicError(500, "");
    }
  const c = data?.credential;
  return (
    <main id="main-content" className="public-verification">
      <Link href="/" className="citizen-wordmark">
        Credenly<span>VERIFICACIÓN PÚBLICA</span>
      </Link>
      <PageHeading
        eyebrow="CONSULTA PÚBLICA"
        title={error ? error.title : "Estado actual de la credencial"}
      >
        {error
          ? error.message
          : "Información consultada desde RAES. El resultado corresponde al estado actual."}
      </PageHeading>
      {error ? (
        <Alert title={error.title} tone="warning">
          {error.message}
        </Alert>
      ) : c && data ? (
        <>
          <Card>
            <p className="ui-eyebrow">{c.categoria}</p>
            <h2>{c.titulo ?? c.tipo}</h2>
            <p>{c.institucion?.nombre ?? "Institución no informada"}</p>
            <CredentialStatus state={c.estadoActual} />
            {c.estadoActual !== "VIGENTE" && (
              <Alert
                title={`Credencial ${c.estadoActual === "REVOCADA" ? "revocada" : "anulada"}`}
                tone={c.estadoActual === "REVOCADA" ? "danger" : "warning"}
              >
                <p>Estado desde {date(c.fechaEstadoTerminal)}.</p>
                {c.motivoEstado && <p>{c.motivoEstado}</p>}
              </Alert>
            )}
            <dl className="credential-details">
              {[
                ["Código RAES", c.codigoRaes],
                ["Tipo", c.tipo],
                ["Versión", String(c.versionActual)],
                ["Fecha de emisión", date(c.fechaEmision)],
                ...(c.programa !== undefined
                  ? [["Programa", c.programa?.nombre ?? "No informado"]]
                  : []),
                ...(c.sede !== undefined
                  ? [["Sede", c.sede?.nombre ?? "No informada"]]
                  : []),
                ...[
                  "descripcion",
                  "fechaGrado",
                  "numeroActa",
                  "numeroFolio",
                  "numeroLibro",
                ]
                  .filter((key) => c[key as keyof typeof c] !== undefined)
                  .map((key) => [
                    (
                      {
                        descripcion: "Descripción",
                        fechaGrado: "Fecha de grado",
                        numeroActa: "Acta",
                        numeroFolio: "Folio",
                        numeroLibro: "Libro",
                      } as Record<string, string>
                    )[key],
                    key === "fechaGrado"
                      ? date(c.fechaGrado)
                      : String(c[key as keyof typeof c] ?? "No informado"),
                  ]),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <p className="live-note">
            Consultada: {date(data.verifiedAt)} · Acceso hasta:{" "}
            {date(data.share.expiresAt)}. Credenly no almacena el estado
            académico.
          </p>
        </>
      ) : null}
      <p className="ui-hint">
        Esta consulta no garantiza la autenticidad de un documento presentado
        por fuera del registro.
      </p>
    </main>
  );
}
