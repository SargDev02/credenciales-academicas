import {
  ShareError,
  shareErrorResponse,
  verifyPublicShare,
} from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ token: string }>;
  },
) {
  try {
    const { token } = await context.params;
    const result = await verifyPublicShare(token, request);

    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof ShareError) {
      return shareErrorResponse(error);
    }

    return shareErrorResponse(error);
  }
}
