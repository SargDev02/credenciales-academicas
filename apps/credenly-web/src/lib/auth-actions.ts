"use server";
import { redirect } from "next/navigation";
import { apiRequest, safeReturnPath, WebApiError } from "@raes/web-core";
import { getWebConfig } from "./env";
import { createWebAuth, clearWebSessionCookies } from "./auth";
export type AuthState = { error?: string; message?: string };
export async function authenticate(
  mode: "login" | "register",
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const email = form.get("email"),
    password = form.get("password");
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < (mode === "register" ? 12 : 1) ||
    password.length > 256
  )
    return { error: "Revisa el correo y la contraseña." };
  if (mode !== "login" && mode !== "register")
    return { error: "Solicitud no válida." };
  const auth = await createWebAuth(true);
  if (mode === "register") {
    const site = new URL(
      process.env.CREDENLY_WEB_SITE_URL ?? "http://localhost:3003",
    );
    const result = await auth.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: new URL("/auth/callback", site.origin).toString(),
      },
    });
    if (result.error)
      return {
        error:
          "No pudimos completar el registro. Revisa tus datos o intenta más tarde.",
      };
    if (!result.data.session)
      return {
        message:
          "Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión.",
      };
    redirect("/onboarding");
  }
  const { data, error } = await auth.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session)
    return {
      error:
        "No pudimos iniciar sesión. Revisa tus datos y confirma tu correo si acabas de registrarte.",
    };
  try {
    await apiRequest(getWebConfig().apiBase, "/api/v1/auth/me", {
      token: data.session.access_token,
      validate: (value): value is { data: { id: string } } =>
        !!value &&
        typeof value === "object" &&
        "data" in value &&
        !!value.data &&
        typeof value.data === "object" &&
        "id" in value.data &&
        value.data.id === data.user.id,
    });
  } catch (error) {
    try {
      await auth.auth.signOut({ scope: "local" });
    } finally {
      await clearWebSessionCookies();
    }
    return {
      error:
        error instanceof WebApiError && error.code === "CITIZEN_ACCOUNT_RESTRICTED"
          ? "El estado de tu cuenta no permite el acceso ciudadano. Contacta con el administrador de Credenly."
          : "No fue posible validar el acceso ciudadano. Si tu cuenta es administrativa, utiliza el acceso de administración.",
    };
  }
  redirect(safeReturnPath(form.get("next"), "/credentials"));
}
export async function logout() {
  const auth = await createWebAuth(true);
  try {
    await auth.auth.signOut({ scope: "local" });
  } finally {
    await clearWebSessionCookies();
  }
  redirect("/login");
}
