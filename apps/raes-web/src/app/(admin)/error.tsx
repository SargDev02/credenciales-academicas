"use client";
import { Alert, Button } from "@raes/ui";
export default function ErrorState({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-state">
      <Alert tone="danger" title="No fue posible cargar la información">
        Comprueba tu conexión y vuelve a intentar. Si tu sesión terminó, inicia
        sesión de nuevo.
      </Alert>
      <div className="ui-actions">
        <Button onClick={reset}>Volver a intentar</Button>
        <a href="/login">Ir a acceso</a>
      </div>
    </div>
  );
}
