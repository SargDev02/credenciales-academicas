import Link from "next/link";
import { Alert, Card } from "@raes/ui";
import { safeReturnPath } from "@raes/web-core";
import { LoginForm } from "../../components/login-form";
import { getWebConfig } from "../../lib/env";
export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso administrativo" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  let configured = true;
  try {
    getWebConfig();
  } catch {
    configured = false;
  }
  return (
    <main id="main-content" className="login-page">
      <section className="login-intro">
        <Link className="product-wordmark" href="/">
          RAES<span>REGISTRO ACADÉMICO</span>
        </Link>
        <div>
          <p className="ui-eyebrow">ADMINISTRACIÓN INSTITUCIONAL</p>
          <h1>
            Información que conecta.
            <br />
            Gestión que da confianza.
          </h1>
          <p>
            Un espacio de trabajo para las instituciones y los servicios que
            forman parte del registro académico.
          </p>
        </div>
        <p className="login-footnote">
          Registro de credenciales académicas · Prototipo
        </p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <Card>
          <p className="ui-eyebrow">BIENVENIDO A RAES</p>
          <h2 id="login-title">Acceso administrativo</h2>
          <p className="ui-muted">
            Ingresa con tu cuenta institucional para continuar.
          </p>
          {configured ? (
            <LoginForm next={safeReturnPath(params.next)} />
          ) : (
            <Alert title="Acceso pendiente de configuración" tone="warning">
              Configura la conexión de esta aplicación con Supabase Auth y RAES
              API antes de iniciar sesión.
            </Alert>
          )}
        </Card>
        <p className="ui-hint">
          ¿Necesitas acceso? Contacta al administrador del registro.
        </p>
      </section>
    </main>
  );
}
