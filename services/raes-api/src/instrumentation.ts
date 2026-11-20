import { operationalLog, requestId } from "@raes/web-core/observability";
import type { Instrumentation } from "next";
export const onRequestError: Instrumentation.onRequestError = (_error, request) => {
  const value=request.headers["x-request-id"];
  operationalLog("raes-api","UNHANDLED_ERROR",{requestId:requestId(typeof value === "string" ? value : null)});
};
