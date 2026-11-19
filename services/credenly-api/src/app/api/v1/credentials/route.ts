import {
  CitizenAuthError,
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  RaesLinkError,
  getLiveCredentialsForUser,
  raesIntegrationErrorResponse,
} from "@/lib/raes-link";
import { RaesClientError } from "@/lib/raes-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = await readCredentials(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function readCredentials(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const credentials = await getLiveCredentialsForUser(user.id);

    return Response.json({
      data: credentials,
      source: "RAES",
      persistedByCredenly: false,
    });
  } catch (error) {
    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    if (
      error instanceof RaesLinkError ||
      error instanceof RaesClientError
    ) {
      return raesIntegrationErrorResponse(error);
    }

    return raesIntegrationErrorResponse(error);
  }
}
