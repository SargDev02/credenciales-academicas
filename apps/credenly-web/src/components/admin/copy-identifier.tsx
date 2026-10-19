"use client";
import { useState } from "react";
export function CopyIdentifier({ value }: { value: string }) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        className="operations-copy"
        type="button"
        aria-label={`Copiar UUID ${value}`}
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(value);
              setMessage("UUID copiado");
            } catch {
              setMessage("Selecciona el UUID para copiarlo");
            }
          })();
        }}
      >
        Copiar
      </button>
      <span className="ui-visually-hidden" role="status">
        {message}
      </span>
    </>
  );
}
