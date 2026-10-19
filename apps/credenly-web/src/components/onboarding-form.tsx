"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@raes/ui";
import {
  updateOnboarding,
  type OnboardingResult,
} from "../lib/onboarding-actions";
export function OnboardingForm({
  kind,
  verificationId,
  names,
}: {
  kind: "profile" | "document" | "link";
  verificationId?: string;
  names?: { nombres: string | null; apellidos: string | null };
}) {
  const [result, setResult] = useState<OnboardingResult>({});
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <form
      className="citizen-form"
      aria-busy={pending}
      onSubmit={(event) => {
        void (async () => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setPending(true);
          setResult({});
          try {
            const response = await updateOnboarding(kind, data);
            setResult(response);
            if (response.message) router.refresh();
          } catch {
            setResult({
              error:
                "No pudimos confirmar el resultado. Actualiza el estado antes de reenviar.",
            });
          } finally {
            setPending(false);
            requestAnimationFrame(() => ref.current?.focus());
          }
        })();
      }}
    >
      <fieldset disabled={pending}>
        <legend className="ui-visually-hidden">
          {kind === "profile"
            ? "Tu perfil"
            : kind === "document"
              ? "Verificación documental"
              : "Vincular identidad"}
        </legend>
        {kind === "profile" ? (
          <>
            <Input
              id="nombres"
              label="Nombres"
              name="nombres"
              defaultValue={names?.nombres ?? ""}
              maxLength={160}
              autoComplete="given-name"
              required
            />
            <Input
              id="apellidos"
              label="Apellidos"
              name="apellidos"
              defaultValue={names?.apellidos ?? ""}
              maxLength={160}
              autoComplete="family-name"
              required
            />
          </>
        ) : kind === "document" ? (
          <Input
            id="documento"
            name="documento"
            type="file"
            label="Imagen del documento"
            accept="image/jpeg,image/png,image/webp"
            hint="JPEG, PNG o WEBP. Hasta 8 MB. Se procesa en el servidor y se elimina la imagen."
            required
          />
        ) : (
          <input
            type="hidden"
            name="verificacionIdentidadId"
            value={verificationId}
          />
        )}
        <Button type="submit" busy={pending}>
          {pending
            ? kind === "document"
              ? "Procesando documento…"
              : "Guardando…"
            : kind === "profile"
              ? "Guardar perfil"
              : kind === "document"
                ? "Enviar documento"
                : "Vincular con RAES"}
        </Button>
      </fieldset>
      <div tabIndex={-1} ref={ref}>
        {result.error && (
          <Alert title="No se pudo completar" tone="danger">
            {result.error}
          </Alert>
        )}
        {result.message && (
          <Alert title="Solicitud completada" tone="success">
            {result.message}
          </Alert>
        )}
      </div>
    </form>
  );
}
