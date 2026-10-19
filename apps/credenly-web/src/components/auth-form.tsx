"use client";
import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@raes/ui";
import { authenticate } from "../lib/auth-actions";
export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "register";
  next: string;
}) {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    authenticate.bind(null, mode),
    {},
  );
  return (
    <form className="citizen-form" aria-busy={pending} action={action}>
      <input type="hidden" name="next" value={next} />
      <Input
        id="email"
        name="email"
        type="email"
        label="Correo electrónico"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={254}
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Contraseña"
        autoComplete={mode === "register" ? "new-password" : "current-password"}
        minLength={mode === "register" ? 12 : 1}
        maxLength={256}
        required
        hint={mode === "register" ? "Usa al menos 12 caracteres." : undefined}
      />
      {state.error && (
        <Alert title="No se pudo continuar" tone="danger">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert title="Revisa tu correo" tone="success">
          {state.message}
        </Alert>
      )}
      <Button type="submit" busy={pending}>
        {pending
          ? "Un momento…"
          : mode === "register"
            ? "Crear cuenta"
            : "Iniciar sesión"}
      </Button>
    </form>
  );
}
