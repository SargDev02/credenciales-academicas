import { Alert, Card, EmptyState, PageHeading } from "@raes/ui";
import {
  getCredentials,
  getRaesLink,
  citizenRequest,
} from "../../../lib/citizen-api";
import { date } from "../../../lib/citizen-model";
import { isShares } from "../../../lib/sharing-model";
import { ShareForm } from "../../../components/share-form";
import { RevokeShare } from "../../../components/revoke-share";
import { CredentialStatus } from "../../../components/credential-status";
export const metadata = { title: "Comparticiones" };
export default async function Shares({
  searchParams,
}: {
  searchParams: Promise<{ credential?: string }>;
}) {
  const [{ credential }, link, payload] = await Promise.all([
    searchParams,
    getRaesLink(),
    citizenRequest("/api/v1/shares", isShares),
  ]);
  const credentials =
    link?.estado === "VERIFICADA" ? await getCredentials() : [];
  const selected = credentials.some((c) => c.id === credential)
    ? credential!
    : "";
  return (
    <>
      <PageHeading eyebrow="COMPARTE CON CONTROL" title="Tus comparticiones">
        Elige qué mostrar y durante cuánto tiempo. Cada consulta recupera el
        estado actual desde RAES.
      </PageHeading>
      <div className="sharing-layout">
        <Card>
          <h2>Crear enlace</h2>
          {credentials.length ? (
            <ShareForm
              credentials={credentials.map((c) => ({
                id: c.id,
                label: `${c.version?.titulo ?? c.tipo} · ${c.institucion?.nombre ?? c.codigoRaes} · ${c.estadoActual}`,
              }))}
              selected={selected}
            />
          ) : (
            <Alert title="Necesitas una credencial disponible">
              Completa la vinculación y consulta tus credenciales antes de crear
              un enlace.
            </Alert>
          )}
        </Card>
        <section aria-labelledby="shares-list-title">
          <h2 id="shares-list-title">Enlaces creados</h2>
          <p className="ui-hint">
            El token completo se entrega solo al crear. Este listado no permite
            recuperar enlaces.
          </p>
          <div className="share-list">
            {payload.data.length ? (
              payload.data.map((share) => (
                <Card key={share.id}>
                  <div className="share-heading">
                    <h3>Acceso · {share.tokenPrefix}…</h3>
                    <CredentialStatus state={share.estado} />
                  </div>
                  <p className="ui-muted">Expira: {date(share.expiresAt)}</p>
                  <p>
                    Credencial:{" "}
                    {credentials.find((c) => c.id === share.raesCredencialId)
                      ?.version?.titulo ?? share.raesCredencialId}
                  </p>
                  <p className="ui-hint">
                    Campos adicionales:{" "}
                    {share.camposVisibles.join(", ") || "ninguno"}
                  </p>
                  {share.estado === "ACTIVA" && <RevokeShare id={share.id} />}
                </Card>
              ))
            ) : (
              <Card>
                <EmptyState title="Todavía no has compartido credenciales">
                  Crea un enlace para que otra persona pueda consultar su estado
                  actual.
                </EmptyState>
              </Card>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
