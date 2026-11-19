"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@raes/ui";
import { revokeShare, type ShareResult } from "../lib/sharing-actions";
export function RevokeShare({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ShareResult>({});
  const router = useRouter();
  if (!confirm)
    return (
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Revocar acceso
      </Button>
    );
  return (
    <div className="revoke-confirm">
      <p>
        El enlace dejará de permitir nuevas consultas. ¿Quieres revocar el
        acceso?
      </p>
      <Button
        busy={pending}
        onClick={() => {
          void (async () => {
            if (pending) return;
            setPending(true);
            try {
              const value = await revokeShare(id);
              setResult(value);
              if (value.message) router.refresh();
            } catch {
              setResult({
                error:
                  "No pudimos confirmar la revocación. Actualiza el estado.",
              });
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        Sí, revocar
      </Button>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => setConfirm(false)}
      >
        Cancelar
      </Button>
      {result.error && (
        <Alert title="No se pudo revocar" tone="danger">
          {result.error}
        </Alert>
      )}
      {result.message && <p role="status">{result.message}</p>}
    </div>
  );
}
