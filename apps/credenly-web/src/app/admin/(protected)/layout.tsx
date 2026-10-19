import Link from "next/link";
import { Alert, Badge, Button } from "@raes/ui";
import { WebApiError } from "@raes/web-core";
import { requireAdminSession } from "../../../lib/admin-auth";
import { adminLogout } from "../../../lib/admin-actions";
import {
  OperationsContext,
  OperationsNavigation,
} from "../../../components/admin/navigation";
export const dynamic = "force-dynamic";
export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile;
  let denied: WebApiError | undefined;
  try {
    profile = (await requireAdminSession()).profile;
  } catch (error) {
    if (error instanceof WebApiError) denied = error;
    else throw error;
  }
  const fullName = profile
    ? `${profile.nombres} ${profile.apellidos}`
    : "Acceso restringido";
  return (
    <div className="operations-app">
      <aside className="operations-sidebar">
        <Link
          href="/admin"
          className="operations-brand"
          aria-label="Credenly Admin · Resumen"
        >
          Credenly<span>Administración</span>
        </Link>
        <OperationsNavigation />
        <div className="operations-readonly">
          <Badge size="compact">Solo lectura</Badge>
          <p>
            Supervisión de procesos.
            <br />
            Sin cambios en datos ciudadanos.
          </p>
        </div>
      </aside>
      <div className="operations-workspace">
        <header className="operations-header">
          <OperationsContext />
          <div className="operations-account">
            <span className="operations-avatar" aria-hidden="true">
              {profile
                ? `${profile.nombres.slice(0, 1)}${profile.apellidos.slice(0, 1)}`
                : "—"}
            </span>
            <div>
              <span className="operations-account-name" title={fullName}>
                {fullName}
              </span>
              <span className="operations-account-role">
                {profile?.rol ?? "Sin acceso validado"}
              </span>
            </div>
          </div>
          <form action={adminLogout}>
            <Button
              variant="secondary"
              type="submit"
              aria-label="Salir de administración"
            >
              Salir
            </Button>
          </form>
        </header>
        <main id="main-content" className="operations-content">
          {denied ? (
            <Alert title="No pudimos abrir la administración" tone="danger">
              {denied.message} <Link href="/admin/login">Volver al acceso</Link>
            </Alert>
          ) : (
            children
          )}
        </main>
        <footer className="operations-footer">
          <span>Credenly Admin · Supervisión operativa</span>
          <span>Entorno de prototipo</span>
        </footer>
      </div>
    </div>
  );
}
