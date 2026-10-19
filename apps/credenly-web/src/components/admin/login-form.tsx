"use client";
import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@raes/ui";
import { adminLogin } from "../../lib/admin-actions";
export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(adminLogin, {});
  return (
    <form action={action} className="citizen-form" aria-busy={pending}>
      <Input
        id="admin-email"
        name="email"
        label="Correo administrativo"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        id="admin-password"
        name="password"
        label="Contraseña"
        type="password"
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
        {pending ? "Validando acceso…" : "Acceder a administración"}
      </Button>
    </form>
  );
}
