import type { z } from "zod";

import { ApiError } from "./api-error";

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "El cuerpo de la petición debe ser JSON válido",
    );
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Los datos enviados no cumplen el contrato de RAES",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
