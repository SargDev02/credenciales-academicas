import { z, type ZodType } from "zod";

export class RequestValidationError extends Error {
  constructor(public readonly status: 400 | 413, public readonly code: string, message: string) { super(message); }
}
export async function readBoundedBody(request: Request, limit: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new RequestValidationError(413, "BODY_TOO_LARGE", "La solicitud supera el tamaño permitido");
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  let size = 0;
  try {
    if (reader) while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestValidationError(413, "BODY_TOO_LARGE", "La solicitud supera el tamaño permitido");
      }
      chunks.push(value);
    }
  } finally { reader?.releaseLock(); }
  return Uint8Array.from(Buffer.concat(chunks)).buffer;
}
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const bytes = await readBoundedBody(request, 64 * 1024);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestValidationError(400, "INVALID_JSON", "El cuerpo de la petición debe ser JSON válido");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new RequestValidationError(400, "VALIDATION_ERROR", "Los datos enviados no son válidos");
  return parsed.data;
}
export function requestValidationErrorResponse(error: unknown): Response | null {
  if (error instanceof RequestValidationError) return Response.json({ error: error.code, message: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return Response.json({ error: "VALIDATION_ERROR", message: "Los datos enviados no son válidos" }, { status: 400 });
  return null;
}
