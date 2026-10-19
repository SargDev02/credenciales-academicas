import Link from "next/link";
import { Alert, Button } from "@raes/ui";
import { WebApiError } from "@raes/web-core";
import { getAdminProfile } from "../../lib/admin-api";
import type { AdminProfile } from "../../lib/admin-model";
import { logout } from "../../lib/actions";
import { Navigation } from "../../components/navigation";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: AdminProfile | undefined;
  let denied: WebApiError | undefined;
  try {
    profile = await getAdminProfile();
  } catch (error) {
    if (error instanceof WebApiError) denied = error;
    else throw error;
  }
  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <Link href="/dashboard" className="product-wordmark">
          RAES<span>REGISTRO ACADÉMICO</span>
        </Link>
        <div className="admin-account">
          <div>
            <strong>{profile?.rol ?? "Sesión administrativa"}</strong>
            <span>{profile ? `${profile.nombres} ${profile.apellidos}` : "Acceso no disponible"}</span>
          </div>
          <form action={logout}>
            <Button type="submit" variant="secondary">
              Salir
            </Button>
          </form>
        </div>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <p className="sidebar-heading">GESTIÓN DEL REGISTRO</p>
          <Navigation />
          <p className="sidebar-note">
            Información académica
            <br />
            con procedencia y trazabilidad.
          </p>
        </aside>
        <main id="main-content" className="admin-content">
          {denied ? (
            <Alert title="No pudimos abrir el registro" tone="danger">
              {denied.message} <Link href="/dashboard">Volver a intentar</Link>
            </Alert>
          ) : (
            children
          )}
        </main>
      </div>
      <footer className="admin-footer">
        RAES · Registro académico <span>Entorno de prototipo</span>
      </footer>
    </div>
  );
}
