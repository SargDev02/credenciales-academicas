import { z } from "zod";

import {
  CitizenAuthError,
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  ShareError,
  createShare,
  createShareInputSchema,
  listShares,
  shareErrorResponse,
} from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const shares = await listShares(user.id);

    return Response.json({ data: shares });
  } catch (error) {
    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    return shareErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const body = await request.json();
    const input = createShareInputSchema.parse(body);
    const result = await createShare(user.id, input);

    return Response.json(
      {
        data: {
          ...result.share,
          token: result.token,
          publicPath: result.publicPath,
          tokenReturnedOnce: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de la compartición no son válidos",
          details: error.issues,
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
