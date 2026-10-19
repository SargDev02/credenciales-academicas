import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getWebConfig } from "./env";

export async function createWebAuth(writable = false) {
  const config = getWebConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: {
      name: config.cookieName,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const value of values)
            jar.set(value.name, value.value, value.options);
        } catch (error) {
          // Proxy refreshes cookies before Server Components render. Actions must
          // propagate write failures instead of pretending login succeeded.
          if (writable) throw error;
        }
      },
    },
  });
}
export const requireSession = cache(async () => {
  const auth = await createWebAuth();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) redirect("/login");
  // The cookie's session is used only after authoritative user verification.
  const {
    data: { session },
  } = await auth.auth.getSession();
  if (!session) redirect("/login");
  return {
    token: session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email ?? "Cuenta ciudadana",
    },
  };
});

export async function clearWebSessionCookies() {
  const jar = await cookies();
  const { cookieName } = getWebConfig();
  for (const cookie of jar.getAll()) {
    if (
      cookie.name === cookieName ||
      cookie.name.startsWith(`${cookieName}.`)
    ) {
      jar.delete(cookie.name);
    }
  }
}
