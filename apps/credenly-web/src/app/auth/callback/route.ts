import { NextResponse } from "next/server";
import { createWebAuth } from "../../../lib/auth";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const site = new URL(
    process.env.CREDENLY_WEB_SITE_URL ?? "http://localhost:3003",
  ).origin;
  if (code && code.length <= 2048) {
    const auth = await createWebAuth(true);
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL("/onboarding", site), {
        headers: { "Cache-Control": "private, no-store" },
      });
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", site), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
