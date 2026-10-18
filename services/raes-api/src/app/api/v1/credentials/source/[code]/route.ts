import { codigoOrigenSchema } from "@raes/contracts";
import { ApiError, apiErrorResponse } from "@/lib/api-error";
import { authenticateInstitution } from "@/lib/institution-auth";
import { getInstitutionCredentialState } from "@/lib/institution-credential-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const identity = await authenticateInstitution(request, ["credentials:read"]);
    const parsed = codigoOrigenSchema.safeParse((await context.params).code);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "El código de origen no es válido");
    return Response.json({ data: await getInstitutionCredentialState(identity, parsed.data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
