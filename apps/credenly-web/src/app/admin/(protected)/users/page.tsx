import Link from "next/link";
import { Alert, Badge, Card, EmptyState } from "@raes/ui";
import { getAdminAccounts, getOverview } from "../../../../lib/admin-api";
import { sectionStates } from "../../../../lib/admin-model";
import {
  formatAdminTimestamp,
  validAccountPage,
} from "../../../../lib/admin-presentation";
import { StateCounts } from "../../../../components/admin/counts";
import { AdminHeading } from "../../../../components/admin/heading";
import { CopyIdentifier } from "../../../../components/admin/copy-identifier";
export const metadata = { title: "Cuentas · Administración" };
export default async function Accounts({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page = "1" } = await searchParams;
  if (!validAccountPage(page))
    return (
      <>
        <AdminHeading
          title="Cuentas y perfiles"
          description="Registro de cuentas y estados de perfiles ciudadanos."
        />
        <Alert title="Página no válida" tone="danger">
          <Link href="/admin/users">Volver al listado de cuentas</Link>
        </Alert>
      </>
    );
  const [accounts, overview] = await Promise.all([
    getAdminAccounts(page),
    getOverview(),
  ]);
  return (
    <>
      <AdminHeading
        title="Cuentas y perfiles"
        description="Registro de cuentas y estados de perfiles ciudadanos."
        observedAt={overview.observedAt}
      />
      <StateCounts
        title={sectionStates.profiles!.title}
        labels={sectionStates.profiles!.labels}
        counts={overview.profiles}
      />
      <Card className="operations-table-card">
        <div className="operations-panel-heading">
          <h2>Cuentas registradas</h2>
          <Badge size="compact">Página {accounts.page}</Badge>
        </div>
        <p className="operations-table-caption">
          La consulta incluye UUID, confirmación del correo y fechas. Una cuenta
          registrada no implica un perfil ciudadano ni permisos administrativos.
        </p>
        {accounts.items.length ? (
          <>
            <p id="accounts-scroll-hint" className="operations-scroll-hint">
              La tabla puede desplazarse horizontalmente. Cada UUID está
              completo y se puede copiar.
            </p>
            <div
              className="operations-table-scroll"
              role="region"
              aria-label="Cuentas registradas"
              aria-describedby="accounts-scroll-hint"
              tabIndex={0}
            >
              <table className="operations-table">
                <caption className="ui-visually-hidden">
                  Cuentas registradas, página {accounts.page}. No se muestran
                  correos ni identidades ciudadanas.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">UUID de cuenta</th>
                    <th scope="col">Correo confirmado</th>
                    <th scope="col">Fecha de registro</th>
                    <th scope="col">Último acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.items.map((account) => (
                    <tr key={account.id}>
                      <th scope="row">
                        <div className="operations-identifier">
                          <code>{account.id}</code>
                          <CopyIdentifier value={account.id} />
                        </div>
                      </th>
                      <td>
                        <Badge
                          size="compact"
                          tone={account.emailConfirmed ? "success" : "warning"}
                        >
                          {account.emailConfirmed
                            ? "Confirmado"
                            : "Sin confirmar"}
                        </Badge>
                      </td>
                      <td>
                        <time dateTime={account.createdAt}>
                          {formatAdminTimestamp(account.createdAt)}
                        </time>
                      </td>
                      <td>
                        {account.lastSignInAt ? (
                          <time dateTime={account.lastSignInAt}>
                            {formatAdminTimestamp(account.lastSignInAt)}
                          </time>
                        ) : (
                          "Sin acceso registrado"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title="Sin cuentas en esta página">
            No se encontraron cuentas. Puedes volver a una página anterior.
          </EmptyState>
        )}
        <nav className="operations-pagination" aria-label="Páginas de cuentas">
          {accounts.page > 1 ? (
            <Link href={`/admin/users?page=${accounts.page - 1}`}>
              Anterior
              <span className="ui-visually-hidden">
                {" "}
                · página {accounts.page - 1}
              </span>
            </Link>
          ) : (
            <span aria-disabled="true">Anterior</span>
          )}
          <span>
            Página {accounts.page} · hasta {accounts.pageSize} cuentas por
            página
          </span>
          {accounts.hasMore && accounts.page < 9999 ? (
            <Link href={`/admin/users?page=${accounts.page + 1}`}>
              Siguiente
              <span className="ui-visually-hidden">
                {" "}
                · página {accounts.page + 1}
              </span>
            </Link>
          ) : (
            <span aria-disabled="true">Siguiente</span>
          )}
        </nav>
      </Card>
      <div className="operations-help">
        <Alert title="Privacidad de las cuentas">
          Este panel no muestra correos, documentos ni información académica.
          Las fechas de acceso no se utilizan para inferir que una cuenta esté
          activa o suspendida.
        </Alert>
      </div>
    </>
  );
}
