"use client";
import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@raes/ui";
import { login } from "../lib/actions";
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="login-form" aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      <Input
        id="email"
        label="Correo institucional"
        type="email"
        name="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="username"
        required
        maxLength={254}
      />
      <Input
        id="password"
        label="Contraseña"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        maxLength={256}
      />
      {state.error && (
        <Alert title="No se pudo acceder" tone="danger">
          {state.error}
        </Alert>
      )}
      <Button type="submit" busy={pending}>
        {pending ? "Validando acceso…" : "Iniciar sesión"}
      </Button>
      <p className="ui-hint">
        Acceso exclusivo para personal autorizado de RAES.
      </p>
    </form>
  );
}
