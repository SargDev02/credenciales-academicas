"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Alert, Button, PageHeading } from "@raes/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="operations-error">
      <PageHeading title="Consulta no disponible">
        No pudimos actualizar la información operativa.
      </PageHeading>
      <Alert title="No pudimos completar la consulta operativa" tone="danger">
        <p>
          Revisa el acceso y la disponibilidad del servicio. No se muestran
          indicadores mientras la consulta esté incompleta.
        </p>
      </Alert>
      <div className="ui-actions">
        <Button
          variant="secondary"
          busy={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Volver a intentar
        </Button>
        <Link href="/admin/login">Ir al acceso administrativo</Link>
      </div>
    </div>
  );
}
