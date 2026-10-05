import {
  authenticateInstitution,
  institutionalAuthErrorResponse,
} from "@/lib/institution-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await authenticateInstitution(request);

    return Response.json({
      data: {
        integrationId: identity.integrationId,
        institutionId: identity.institutionId,
        clientId: identity.clientId,
        integrationName: identity.integrationName,
        scopes: identity.scopes,
      },
    });
  } catch (error) {
    return institutionalAuthErrorResponse(error);
  }
}
