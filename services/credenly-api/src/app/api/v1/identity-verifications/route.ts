import { readBoundedBody, RequestValidationError, requestValidationErrorResponse } from "@/lib/request-validation";
import {
  CitizenAuthError,
  authenticateCitizen,
  citizenAuthErrorResponse,
} from "@/lib/auth";
import {
  IdentityVerificationError,
  getLatestIdentityVerification,
  identityVerificationErrorResponse,
  processIdentityDocument,
} from "@/lib/identity-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeVerification(
  verification: Awaited<
    ReturnType<typeof getLatestIdentityVerification>
  >,
) {
  if (!verification) {
    return null;
  }

  return {
    id: verification.id,
    tipoDocumento: verification.tipo_documento_extraido,
    numeroDocumento: verification.numero_documento_extraido,
    nombres: verification.nombres_extraidos,
    apellidos: verification.apellidos_extraidos,
    confianzaOcr: verification.confianza_ocr,
    estado: verification.estado,
    motivoFallo: verification.motivo_fallo,
    motivoRevision: verification.motivo_revision,
    proveedorOcr: verification.proveedor_ocr,
    documentoMimeType: verification.documento_mime_type,
    processedAt: verification.processed_at,
    imagenEliminadaAt: verification.imagen_eliminada_at,
    createdAt: verification.created_at,
    updatedAt: verification.updated_at,
    canLinkRaes: verification.estado === "APROBADA",
  };
}

export async function GET(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const verification = await getLatestIdentityVerification(
      user.id,
    );

    return Response.json({
      data: serializeVerification(verification),
    });
  } catch (error) {
    const validation = requestValidationErrorResponse(error);
    if (validation) return validation;
    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    return identityVerificationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateCitizen(request);
    const bytes = await readBoundedBody(request, 8 * 1024 * 1024 + 64 * 1024);
    let formData: FormData;
    try {
      formData = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    } catch {
      throw new RequestValidationError(400, "INVALID_MULTIPART", "El documento debe enviarse como multipart válido");
    }
    const document = formData.get("documento");

    if (!(document instanceof File)) {
      return Response.json(
        {
          error: "DOCUMENT_REQUIRED",
          message:
            "Se requiere una imagen en el campo multipart 'documento'",
        },
        { status: 400 },
      );
    }

    const verification = await processIdentityDocument(
      user.id,
      document,
    );

    return Response.json(
      {
        data: serializeVerification(verification),
      },
      { status: 201 },
    );
  } catch (error) {
    const validation = requestValidationErrorResponse(error);
    if (validation) return validation;
    if (error instanceof CitizenAuthError) {
      return citizenAuthErrorResponse(error);
    }

    if (error instanceof IdentityVerificationError) {
      return identityVerificationErrorResponse(error);
    }

    return identityVerificationErrorResponse(error);
  }
}
