"use client";
import { Alert, Button } from "@raes/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Alert title="No pudimos consultar tu información" tone="danger">
      <p>Intenta de nuevo. Si tu sesión terminó, vuelve a iniciar sesión.</p>
      <Button onClick={reset} variant="secondary">
        Volver a intentar
      </Button>
      <a href="/login">Iniciar sesión</a>
    </Alert>
  );
}
