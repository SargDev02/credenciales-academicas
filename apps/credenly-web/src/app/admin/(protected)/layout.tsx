import Link from "next/link";
import { Alert, Button } from "@raes/ui";
import { WebApiError } from "@raes/web-core";
import { requireAdminSession } from "../../../lib/admin-auth";
import { adminLogout } from "../../../lib/admin-actions";
import { OperationsNavigation } from "../../../components/admin/navigation";
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
  return (
    <div className="operations-app">
      <header className="operations-header">
        <Link href="/admin" className="citizen-wordmark">
          Credenly<span>ADMINISTRACIÓN OPERATIVA</span>
        </Link>
        <div>
          <span>
            {profile
              ? `${profile.nombres} ${profile.apellidos}`
              : "Acceso restringido"}
          </span>
          <strong>{profile?.rol ?? "Sin acceso validado"}</strong>
        </div>
        <form action={adminLogout}>
          <Button variant="secondary" type="submit">
            Salir de administración
          </Button>
        </form>
      </header>
      <div className="operations-body">
        <aside>
          <p className="ui-eyebrow">SUPERVISIÓN</p>
          <OperationsNavigation />
          <p className="ui-hint">
            Consulta operativa.
            <br />
            Sin gestión de identidades ni datos académicos.
          </p>
        </aside>
        <main id="main-content" className="operations-content">
          {denied ? (
            <Alert title="No pudimos abrir la administración" tone="danger">
              {denied.message} <Link href="/admin/login">Volver al acceso</Link>
            </Alert>
          ) : (
            children
          )}
        </main>
      </div>
      <footer className="citizen-footer">
        Credenly Admin · Consulta operativa <span>Entorno de prototipo</span>
      </footer>
    </div>
  );
}
