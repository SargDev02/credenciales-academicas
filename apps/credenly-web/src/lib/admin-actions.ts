"use server";
import { redirect } from "next/navigation";
import { apiRequest } from "@raes/web-core";
import { createScopedWebAuth, clearScopedWebSessionCookies } from "./auth";
import { getWebConfig } from "./env";
import {
  adminCookieName,
  isAdminProfile,
  adminReturnPath,
} from "./admin-model";
export type AdminLoginState = { error?: string };
export async function adminLogin(
  _state: AdminLoginState,
  form: FormData,
): Promise<AdminLoginState> {
  const email = form.get("email"),
    password = form.get("password");
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 256
  )
    return { error: "Revisa el correo y la contraseña." };
  const auth = await createScopedWebAuth(adminCookieName, true);
  const { data, error } = await auth.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session)
    return { error: "No pudimos iniciar sesión. Revisa tus datos." };
  try {
    await apiRequest(getWebConfig().apiBase, "/api/v1/admin/me", {
      token: data.session.access_token,
      validate: isAdminProfile,
    });
  } catch {
    try {
      await auth.auth.signOut({ scope: "local" });
    } finally {
      await clearScopedWebSessionCookies(adminCookieName);
    }
    return {
      error:
        "No fue posible validar tu acceso administrativo a Credenly. Una cuenta ciudadana no concede estos permisos.",
    };
  }
  redirect(adminReturnPath(form.get("next")));
}
export async function adminLogout() {
  const auth = await createScopedWebAuth(adminCookieName, true);
  try {
    await auth.auth.signOut({ scope: "local" });
  } finally {
    await clearScopedWebSessionCookies(adminCookieName);
  }
  redirect("/admin/login");
}
