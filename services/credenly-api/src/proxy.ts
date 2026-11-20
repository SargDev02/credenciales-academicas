import { NextResponse, type NextRequest } from "next/server";
import { enforceApiAdmission, admissionResponse } from "@raes/web-core/admission";
import { requestId } from "@raes/web-core/observability";
export async function proxy(request: NextRequest) {
  const id = requestId(request.headers.get("x-request-id"));
  request.headers.set("x-request-id",id);
  try { await enforceApiAdmission(request,"CREDENLY"); }
  catch(error) { return admissionResponse(error,"credenly-api",id); }
  const response=NextResponse.next({request});
  response.headers.set("X-Request-Id",id);
  return response;
}
export const config = { matcher: "/api/:path*" };
