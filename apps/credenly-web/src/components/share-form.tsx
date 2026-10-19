"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, FormField, Input } from "@raes/ui";
import { createShare, type ShareResult } from "../lib/sharing-actions";
import { visibleFields } from "../lib/sharing-model";
export function ShareForm({
  credentials,
  selected,
}: {
  credentials: { id: string; label: string }[];
  selected: string;
}) {
  const [result, setResult] = useState<ShareResult>({});
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const clear = () => setResult({});
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);
  return (
    <>
      <form
        className="citizen-form"
        aria-busy={pending}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || result.publicPath) return;
          const data = new FormData(event.currentTarget);
          setPending(true);
          setCopied("");
          try {
            const value = await createShare(data);
            setResult(value);
            if (value.publicPath) router.refresh();
          } catch {
            setResult({
              error:
                "No pudimos confirmar la creación. Revisa el listado antes de reenviar.",
            });
          } finally {
            setPending(false);
            requestAnimationFrame(() => ref.current?.focus());
          }
        }}
      >
        <fieldset disabled={pending || !!result.publicPath}>
          <legend className="ui-visually-hidden">
            Crear enlace de compartición
          </legend>
          <FormField id="share-credential" label="Credencial">
            <select
              id="share-credential"
              className="ui-input"
              name="raesCredencialId"
              required
              defaultValue={selected}
            >
              <option value="" disabled>
                Selecciona una credencial
              </option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormField>
          <Input
            id="share-hours"
            label="Duración en horas"
            name="expiresInHours"
            type="number"
            min={1}
            max={720}
            step={1}
            defaultValue={168}
            required
            hint="Entre 1 hora y 30 días (720 horas)."
          />
          <fieldset className="visible-fields">
            <legend>Campos adicionales visibles</legend>
            {visibleFields.map((field) => (
              <label key={field.value}>
                <input
                  type="checkbox"
                  name="camposVisibles"
                  value={field.value}
                  defaultChecked={["programa", "sede", "fechaGrado"].includes(
                    field.value,
                  )}
                />
                {field.label}
              </label>
            ))}
          </fieldset>
          <p className="ui-hint">
            Siempre se muestran título, institución, código, tipo, fecha de
            emisión, estado y versión. Un estado revocado o anulado siempre será
            visible.
          </p>
          <Button type="submit" busy={pending}>
            {pending ? "Creando enlace…" : "Crear enlace"}
          </Button>
        </fieldset>
      </form>
      <div ref={ref} tabIndex={-1} className="share-result">
        {result.error && (
          <Alert title="No se pudo crear el enlace" tone="danger">
            {result.error}
          </Alert>
        )}
        {result.publicPath && (
          <>
            <Alert title="Copia tu enlace ahora" tone="success">
              {result.message} No se puede recuperar posteriormente.
            </Alert>
            <Input
              id="created-share-link"
              label="Enlace de verificación"
              readOnly
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}${result.publicPath}`
                  : result.publicPath
              }
              autoComplete="off"
            />
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}${result.publicPath}`,
                  );
                  setCopied("Enlace copiado.");
                } catch {
                  setCopied("Selecciona el enlace y cópialo manualmente.");
                }
              }}
            >
              Copiar enlace
            </Button>
            <p role="status">{copied}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setResult({});
                setCopied("");
              }}
            >
              Cerrar enlace
            </Button>
          </>
        )}
      </div>
    </>
  );
}
