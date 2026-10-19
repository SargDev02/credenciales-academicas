"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, FormField, Input } from "@raes/ui";
import { createRecord } from "../lib/provisioning-actions";
import type { CreationKind, CreationResult } from "../lib/provisioning-model";

export function CreationForm({
  kind,
  institutionId,
}: {
  kind: CreationKind;
  institutionId?: string;
}) {
  const [result, setResult] = useState<CreationResult>({});
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const prefix = `create-${kind}`;
  const label =
    kind === "institution"
      ? "Crear institución"
      : kind === "client"
        ? "Crear cliente API"
        : "Crear integración";
  useEffect(() => {
    const clear = () => {
      setResult({});
      setCopied("");
    };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, []);
  useEffect(() => {
    if (result.error || result.createdId) resultRef.current?.focus();
  }, [result]);
  return (
    <Card className="creation-card">
      <details>
        <summary>{label}</summary>
        <form
          className="creation-form"
          aria-busy={pending}
          onSubmit={(event) => {
            void (async () => {
              event.preventDefault();
              if (pending || result.createdId) return;
              const form = event.currentTarget;
              const data = new FormData(form);
              setPending(true);
              setCopied("");
              try {
                const response = await createRecord(kind, data);
                setResult(response);
                if (response.createdId) {
                  form.reset();
                  router.refresh();
                }
              } catch {
                setResult({
                  error:
                    "No pudimos confirmar el alta. Revisa el listado antes de reenviar.",
                });
              } finally {
                setPending(false);
              }
            })();
          }}
        >
          <fieldset disabled={pending || !!result.createdId}>
            <legend className="ui-visually-hidden">{label}</legend>
            {institutionId && (
              <input type="hidden" name="institutionId" value={institutionId} />
            )}
            <Input
              id={`${prefix}-name`}
              name="nombre"
              label="Nombre"
              required
              minLength={2}
              maxLength={kind === "institution" ? 200 : 160}
              error={result.fieldErrors?.nombre}
            />
            {kind === "institution" ? (
              <>
                <Input
                  id={`${prefix}-nit`}
                  name="nit"
                  label="NIT"
                  required
                  minLength={3}
                  maxLength={40}
                  error={result.fieldErrors?.nit}
                />
                <Input
                  id={`${prefix}-type`}
                  name="tipoInstitucion"
                  label="Tipo de institución"
                  required
                  minLength={2}
                  maxLength={80}
                  error={result.fieldErrors?.tipoInstitucion}
                />
                <Input
                  id={`${prefix}-snies`}
                  name="codigoSnies"
                  label="Código SNIES (opcional)"
                  maxLength={40}
                  error={result.fieldErrors?.codigoSnies}
                />
              </>
            ) : (
              <>
                {kind === "client" && (
                  <FormField
                    id={`${prefix}-type`}
                    label="Tipo de cliente"
                    error={result.fieldErrors?.tipoCliente}
                  >
                    <select
                      id={`${prefix}-type`}
                      className="ui-input"
                      name="tipoCliente"
                      required
                      defaultValue=""
                      aria-invalid={
                        !!result.fieldErrors?.tipoCliente || undefined
                      }
                      aria-describedby={
                        result.fieldErrors?.tipoCliente
                          ? `${prefix}-type-error`
                          : undefined
                      }
                    >
                      <option value="" disabled>
                        Selecciona un tipo
                      </option>
                      <option value="CREDENLY">Credenly</option>
                      <option value="VERIFICADOR">Verificador</option>
                      <option value="GOBERNACION">Gobernación</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </FormField>
                )}
                <Input
                  id={`${prefix}-scopes`}
                  name="scopes"
                  label={`Permisos solicitados${kind === "integration" ? " (opcional)" : ""}`}
                  required={kind === "client"}
                  maxLength={2000}
                  error={result.fieldErrors?.scopes}
                  hint={
                    kind === "integration"
                      ? "Códigos separados por comas. Vacío: RAES asigna los permisos predeterminados. La API valida los permisos admitidos."
                      : "Códigos separados por comas. RAES valida cuáles admite este tipo de alta. Consulta la documentación de autenticación del proyecto."
                  }
                />
                <p className="ui-hint">
                  La clave secreta se entrega una sola vez. Prepara un lugar
                  seguro para conservarla.
                </p>
              </>
            )}
            <Button type="submit" busy={pending}>
              {pending ? "Creando…" : label}
            </Button>
          </fieldset>
        </form>
        <div ref={resultRef} tabIndex={-1} className="creation-result">
          {result.error && (
            <Alert title="No se completó el alta" tone="danger">
              {result.error}
            </Alert>
          )}
          {result.createdId && (
            <Alert title="Registro creado" tone="success">
              Identificador:{" "}
              <span className="mono-cell">{result.createdId}</span>
            </Alert>
          )}
          {result.credentials && (
            <div className="secret-result">
              <Alert title="Guarda esta clave ahora" tone="warning">
                Se muestra únicamente en esta respuesta. Al cerrar o salir de
                esta página no podrás recuperarla. No la compartas en capturas
                ni mensajes.
              </Alert>
              <Input
                id={`${prefix}-client-id`}
                label="Client ID"
                value={result.credentials.clientId}
                readOnly
                autoComplete="off"
              />
              <Input
                id={`${prefix}-secret`}
                label="Clave secreta"
                value={result.credentials.clientSecret}
                readOnly
                autoComplete="off"
                spellCheck={false}
              />
              <p>
                Permisos confirmados por RAES:{" "}
                {result.credentials.scopes.join(", ")}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  void (async () => {
                    try {
                      await navigator.clipboard.writeText(
                        result.credentials!.clientSecret,
                      );
                      setCopied("Clave copiada.");
                    } catch {
                      setCopied(
                        "No pudimos copiarla. Selecciona el campo y cópiala manualmente.",
                      );
                    }
                  })();
                }}
              >
                Copiar clave
              </Button>
              <p role="status">{copied}</p>
            </div>
          )}
          {result.createdId && (
            <Button
              variant="secondary"
              onClick={() => {
                setResult({});
                setCopied("");
              }}
            >
              Cerrar resultado
            </Button>
          )}
        </div>
      </details>
    </Card>
  );
}
