import { PageHeading, Card, Input, Button, EmptyState, Alert } from "@raes/ui";
import { getApiClients } from "../../../lib/admin-api";
import { Status } from "../../../components/status";
import { filterRecords, formatDate } from "../../../lib/admin-model";
export const metadata = { title: "Clientes API" };
export default async function ApiClients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const clients = filterRecords(await getApiClients(), q, "");
  return (
    <>
      <PageHeading eyebrow="SERVICIOS CONSUMIDORES" title="Clientes API">
        Aplicaciones autorizadas para consumir información del registro.
      </PageHeading>
      <form className="admin-filters admin-filters--search">
        <Input
          id="client-search"
          label="Buscar por nombre"
          name="q"
          type="search"
          maxLength={160}
          defaultValue={q ?? ""}
          placeholder="Nombre de la aplicación"
        />
        <Button variant="secondary" type="submit">
          Buscar
        </Button>
      </form>
      {clients.length ? (
        <div
          className="admin-table-region"
          role="region"
          aria-label="Tabla de clientes API"
          tabIndex={0}
        >
          <table className="admin-table">
            <caption className="ui-visually-hidden">
              Clientes API registrados
            </caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Identificador público</th>
                <th scope="col">Estado</th>
                <th scope="col">Último uso</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td data-label="Cliente">
                    <strong>{c.nombre}</strong>
                    <span className="table-secondary">{c.tipoCliente}</span>
                  </td>
                  <td className="mono-cell" data-label="Identificador público">
                    {c.clientId}
                  </td>
                  <td data-label="Estado">
                    <Status value={c.estado} />
                  </td>
                  <td data-label="Último uso">{formatDate(c.ultimoUsoAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <EmptyState title="Sin clientes para mostrar">
            Prueba otro nombre para encontrar una aplicación.
          </EmptyState>
        </Card>
      )}
      <div className="admin-section">
        <Alert title="Consulta de clientes">
          Los permisos asignados no se incluyen en esta consulta. Las altas
          todavía no están habilitadas en la interfaz.
        </Alert>
      </div>
    </>
  );
}
