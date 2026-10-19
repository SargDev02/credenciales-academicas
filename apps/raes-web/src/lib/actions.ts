"use server";
import { redirect } from "next/navigation";
import { apiRequest, safeReturnPath } from "@raes/web-core";
import { createWebAuth, clearWebSessionCookies } from "./auth";
import { getWebConfig } from "./env";
import { isInstitutions } from "./admin-model";
export type LoginState = { error?: string };
export async function login(
  _state: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = form.get("email");
  const password = form.get("password");
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 256
  )
    return { error: "Revisa el correo y la contraseña." };
  const auth = await createWebAuth(true);
  const { data, error } = await auth.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session)
    return {
      error: "No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.",
    };
  try {
    await apiRequest(getWebConfig().apiBase, "/api/v1/admin/institutions", {
      token: data.session.access_token,
      validate: isInstitutions,
    });
  } catch {
    try {
      await auth.auth.signOut({ scope: "local" });
    } finally {
      await clearWebSessionCookies();
    }
    return {
      error:
        "No fue posible validar tu acceso administrativo. Consulta con el administrador o intenta de nuevo.",
    };
  }
  redirect(safeReturnPath(form.get("next")));
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
