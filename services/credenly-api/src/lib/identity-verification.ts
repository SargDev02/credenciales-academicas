import { getCredenlySupabaseAdmin } from "./supabase-admin";
import {
  decideIdentityVerification,
  parseColombianIdentityDocument,
} from "./ocr-document-parser";
import { getOcrProvider, OcrResourceError } from "./ocr-provider";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export type IdentityVerificationRow = {
  id: string;
  usuario_id: string;
  tipo_documento_extraido: string | null;
  numero_documento_extraido: string | null;
  nombres_extraidos: string | null;
  apellidos_extraidos: string | null;
  confianza_ocr: number | null;
  estado:
    | "PENDIENTE"
    | "PROCESADA"
    | "APROBADA"
    | "RECHAZADA"
    | "REVISION";
  motivo_fallo: string | null;
  motivo_revision: string | null;
  proveedor_ocr: string | null;
  documento_mime_type: string | null;
  processed_at: string | null;
  imagen_eliminada_at: string | null;
  created_at: string;
  updated_at: string;
};

export class IdentityVerificationError extends Error {
  constructor(
    public readonly status: 400 | 404 | 413 | 415 | 429 | 500 | 504,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IdentityVerificationError";
  }
}

export function validateIdentityDocumentFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new IdentityVerificationError(
      415,
      "UNSUPPORTED_DOCUMENT_TYPE",
      "El documento debe ser una imagen JPEG, PNG o WEBP",
    );
  }

  if (file.size <= 0) {
    throw new IdentityVerificationError(
      400,
      "EMPTY_DOCUMENT",
      "La imagen del documento está vacía",
    );
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new IdentityVerificationError(
      413,
      "DOCUMENT_TOO_LARGE",
      "La imagen del documento supera el límite de 8 MB",
    );
  }
}

export async function processIdentityDocument(
  userId: string,
  file: File,
): Promise<IdentityVerificationRow> {
  validateIdentityDocumentFile(file);

  const supabase = getCredenlySupabaseAdmin();
  const ocrProvider = getOcrProvider();

  const { data: pendingData, error: pendingError } =
    await supabase
      .from("verificaciones_identidad")
      .insert({
        usuario_id: userId,
        estado: "PENDIENTE",
        proveedor_ocr: ocrProvider.name,
        documento_mime_type: file.type,
        imagen_path: null,
      })
      .select("id")
      .single();

  if (pendingError || !pendingData) {
    throw new IdentityVerificationError(
      500,
      "VERIFICATION_CREATE_FAILED",
      "No fue posible iniciar la verificación de identidad",
    );
  }

  const verificationId = pendingData.id as string;
  const processedAt = new Date().toISOString();

  try {
    const image = Buffer.from(await file.arrayBuffer());
    const ocr = await ocrProvider.recognize(image);
    const parsed = parseColombianIdentityDocument(ocr.text);
    const decision = decideIdentityVerification(
      parsed,
      ocr.confidence,
    );

    const { data, error } = await supabase
      .from("verificaciones_identidad")
      .update({
        tipo_documento_extraido: parsed.tipoDocumento,
        numero_documento_extraido: parsed.numeroDocumento,
        nombres_extraidos: parsed.nombres,
        apellidos_extraidos: parsed.apellidos,
        confianza_ocr: ocr.confidence,
        estado: decision.estado,
        motivo_fallo: decision.motivoFallo,
        motivo_revision: decision.motivoRevision,
        texto_extraido: ocr.text,
        processed_at: processedAt,
        imagen_eliminada_at: processedAt,
        imagen_path: null,
      })
      .eq("id", verificationId)
      .eq("usuario_id", userId)
      .select(
        "id,usuario_id,tipo_documento_extraido,numero_documento_extraido,nombres_extraidos,apellidos_extraidos,confianza_ocr,estado,motivo_fallo,motivo_revision,proveedor_ocr,documento_mime_type,processed_at,imagen_eliminada_at,created_at,updated_at",
      )
      .single();

    if (error || !data) {
      throw new IdentityVerificationError(
        500,
        "VERIFICATION_UPDATE_FAILED",
        "No fue posible guardar el resultado del OCR",
      );
    }

    return data;
  } catch (caught) {
    const error = caught instanceof OcrResourceError
      ? new IdentityVerificationError(caught.status, caught.code, caught.message)
      : caught;
    const failedAt = new Date().toISOString();

    await supabase
      .from("verificaciones_identidad")
      .update({
        estado: "RECHAZADA",
        motivo_fallo:
          error instanceof IdentityVerificationError
            ? error.message
            : "No fue posible procesar la imagen con OCR local",
        processed_at: failedAt,
        imagen_eliminada_at: failedAt,
        imagen_path: null,
      })
      .eq("id", verificationId)
      .eq("usuario_id", userId);

    if (error instanceof IdentityVerificationError) {
      throw error;
    }

    console.error("Local OCR processing failed");

    throw new IdentityVerificationError(
      500,
      "OCR_PROCESSING_FAILED",
      "No fue posible procesar el documento con OCR local",
    );
  }
}

export async function getLatestIdentityVerification(
  userId: string,
): Promise<IdentityVerificationRow | null> {
  const supabase = getCredenlySupabaseAdmin();

  const { data, error } = await supabase
    .from("verificaciones_identidad")
    .select(
      "id,usuario_id,tipo_documento_extraido,numero_documento_extraido,nombres_extraidos,apellidos_extraidos,confianza_ocr,estado,motivo_fallo,motivo_revision,proveedor_ocr,documento_mime_type,processed_at,imagen_eliminada_at,created_at,updated_at",
    )
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new IdentityVerificationError(
      500,
      "VERIFICATION_LOOKUP_FAILED",
      "No fue posible consultar la verificación de identidad",
    );
  }

  return data;
}

export function identityVerificationErrorResponse(
  error: unknown,
): Response {
  if (error instanceof IdentityVerificationError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
        ...(error.status === 429 ? { headers: { "Retry-After": "30" } } : {}),
      },
    );
  }

  console.error("Unexpected identity verification error");

  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "No fue posible completar la verificación",
    },
    { status: 500 },
  );
}
