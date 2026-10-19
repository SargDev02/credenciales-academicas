import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName } from "./lib/admin-model";
import { getWebConfig } from "./lib/env";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  let config;
  try {
    config = getWebConfig();
  } catch {
    return response;
  }
  const administrative =
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/");
  const cookieName = administrative ? adminCookieName : config.cookieName;
  const auth = createServerClient(config.url, config.publishableKey, {
    cookieOptions: {
      name: cookieName,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        for (const value of values)
          request.cookies.set(value.name, value.value);
        response = NextResponse.next({ request });
        for (const value of values)
          response.cookies.set(value.name, value.value, value.options);
        for (const [key, value] of Object.entries(headers))
          response.headers.set(key, value);
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  if (request.cookies.getAll().some((c) => c.name.startsWith(cookieName)))
    await auth.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/register",
    "/onboarding/:path*",
    "/credentials/:path*",
    "/shares/:path*",
  ],
};
