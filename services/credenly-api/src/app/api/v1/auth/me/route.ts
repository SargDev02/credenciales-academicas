import {
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateCitizen(request);

    return Response.json({
      data: {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return citizenAuthErrorResponse(error);
  }
}
