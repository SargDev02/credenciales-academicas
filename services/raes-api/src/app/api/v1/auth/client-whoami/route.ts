import {
  apiClientAuthErrorResponse,
  authenticateApiClient,
} from "@/lib/api-client-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const client = await authenticateApiClient(request);

    return Response.json({
      data: {
        id: client.clientDbId,
        clientId: client.clientId,
        nombre: client.clientName,
        tipoCliente: client.clientType,
        scopes: client.scopes,
      },
    });
  } catch (error) {
    return apiClientAuthErrorResponse(error);
  }
}
