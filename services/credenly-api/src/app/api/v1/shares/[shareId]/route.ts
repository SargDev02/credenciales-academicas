import { z } from "zod";

import {
  CitizenAuthError,
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  ShareError,
  revokeShare,
  shareErrorResponse,
} from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const shareIdSchema = z.string().uuid();

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ shareId: string }>;
  },
) {
  try {
    const user = await authenticateCitizen(request);
    const { shareId } = await context.params;
    const parsedShareId = shareIdSchema.parse(shareId);
    const share = await revokeShare(user.id, parsedShareId);

    return Response.json({ data: share });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "El identificador de compartición no es válido",
        },
        { status: 400 },
      );
    }

    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    if (error instanceof ShareError) {
      return shareErrorResponse(error);
    }

    return shareErrorResponse(error);
  }
}
