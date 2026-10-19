"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@raes/ui";
export function RefreshControl() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Actualizando…" : "Actualizar"}
      <span className="ui-visually-hidden"> consulta</span>
    </Button>
  );
}
