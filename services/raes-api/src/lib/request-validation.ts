import type { ZodType } from "zod";
import { ApiError } from "./api-error";

const MAX_JSON_BYTES = 64 * 1024;
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_JSON_BYTES) throw new ApiError(413, "BODY_TOO_LARGE", "La solicitud supera el límite de 64 KiB");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  let body: unknown;
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_JSON_BYTES) {
          void reader.cancel().catch(() => {});
          throw new ApiError(413, "BODY_TOO_LARGE", "La solicitud supera el límite de 64 KiB");
        }
        chunks.push(value);
      }
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_JSON", "El cuerpo de la petición debe ser JSON válido");
  } finally { reader?.releaseLock(); }
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", "Los datos enviados no cumplen el contrato de RAES");
  return result.data;
}
