import { NextResponse, type NextRequest } from "next/server";
import { apiRequestLimit, LocalRequestLimiter } from "@raes/web-core/security";
const limiter = new LocalRequestLimiter();
export function proxy(request: NextRequest) {
  const admission = limiter.consume(apiRequestLimit(request.nextUrl.pathname, request.method));
  if (!admission.allowed) return NextResponse.json(
    { error: "RATE_LIMITED", message: "Demasiadas solicitudes. Intenta más tarde" },
    { status: 429, headers: { "Retry-After": String(admission.retryAfter), "Cache-Control": "private, no-store" } },
  );
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
