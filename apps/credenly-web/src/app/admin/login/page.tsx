import Link from "next/link";
import { Alert, Card } from "@raes/ui";
import { AdminLoginForm } from "../../../components/admin/login-form";
import { getWebConfig } from "../../../lib/env";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso administrativo" };
export default function AdminLogin() {
  let configured = true;
  try {
    getWebConfig();
  } catch {
    configured = false;
  }
  return (
    <main id="main-content" className="operations-login">
      <div className="operations-login-intro">
        <Link className="operations-brand" href="/admin">
          Credenly<span>Administración</span>
        </Link>
        <h1>Administración de Credenly</h1>
        <p>Acceso exclusivo para operación del servicio.</p>
        <ul className="operations-login-scope">
          <li>
            <span aria-hidden="true">01</span>Estados de los procesos ciudadanos
          </li>
          <li>
            <span aria-hidden="true">02</span>Disponibilidad y conexión con RAES
          </li>
          <li>
            <span aria-hidden="true">03</span>Supervisión operativa de solo
            lectura
          </li>
        </ul>
      </div>
      <Card className="operations-login-card">
        <div>
          <p className="ui-eyebrow">ACCESO RESTRINGIDO</p>
          <h2>Iniciar sesión</h2>
        </div>
        {configured ? (
          <AdminLoginForm />
        ) : (
          <Alert title="Acceso pendiente de configuración" tone="warning">
            El acceso administrativo no está disponible en este entorno.
          </Alert>
        )}
        <p className="operations-login-notice">
          El acceso administrativo es independiente de las cuentas ciudadanas.
        </p>
        <Link href="/login" className="operations-login-return">
          Ir al acceso ciudadano<span aria-hidden="true"> →</span>
        </Link>
      </Card>
    </main>
  );
}
