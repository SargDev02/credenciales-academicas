import Link from "next/link";
import { Alert, Card } from "@raes/ui";
import { getWebConfig } from "../lib/env";
import { AuthForm } from "./auth-form";
export function AuthPage({
  mode,
  next = "/credentials",
  failed = false,
}: {
  mode: "login" | "register";
  next?: string;
  failed?: boolean;
}) {
  let configured = true;
  try {
    getWebConfig();
  } catch {
    configured = false;
  }
  return (
    <main id="main-content" className="citizen-auth">
      <Link href="/" className="citizen-wordmark">
        Credenly<span>TU HISTORIA ACADÉMICA</span>
      </Link>
      <div className="auth-intro">
        <p className="ui-eyebrow">UN LUGAR PARA TUS LOGROS</p>
        <h1>
          {mode === "login"
            ? "Tu trayectoria, contigo."
            : "Comienza con tu cuenta."}
        </h1>
        <p>Consulta tus credenciales y comparte su estado actual desde RAES.</p>
      </div>
      <Card>
        <h2>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h2>
        <p className="ui-muted">
          {mode === "login"
            ? "Ingresa para consultar tu información."
            : "Confirmaremos tu correo antes de continuar con tu perfil."}
        </p>
        {failed && (
          <Alert title="No pudimos confirmar el correo" tone="warning">
            El enlace pudo vencer. Intenta iniciar sesión o solicita un nuevo
            registro si aún no confirmaste la cuenta.
          </Alert>
        )}
        {configured ? (
          <AuthForm mode={mode} next={next} />
        ) : (
          <Alert title="Acceso pendiente de configuración" tone="warning">
            Configura la conexión con Auth y Credenly API.
          </Alert>
        )}
        <p>
          {mode === "login" ? "¿Es tu primera visita? " : "¿Ya tienes cuenta? "}
          <Link href={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
          </Link>
        </p>
      </Card>
      <p className="ui-hint">
        Prototipo · Tus datos académicos permanecen en RAES.
      </p>
    </main>
  );
}
