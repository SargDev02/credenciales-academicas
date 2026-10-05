import { createHash } from "node:crypto";

import { z } from "zod";

import { ApiError } from "./api-error";

const requestIdSchema = z.string().uuid();

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency-Key contiene caracteres no permitidos",
  );

export type MutationRequestContext = {
  requestId: string;
  idempotencyKey: string;
};

export function getMutationRequestContext(
  request: Request,
): MutationRequestContext {
  const requestId = request.headers.get("x-request-id");
  const idempotencyKey = request.headers.get("idempotency-key");

  const parsedRequestId = requestIdSchema.safeParse(requestId);

  if (!parsedRequestId.success) {
    throw new ApiError(
      400,
      "INVALID_REQUEST_ID",
      "X-Request-Id es obligatorio y debe ser un UUID válido",
    );
  }

  const parsedIdempotencyKey =
    idempotencyKeySchema.safeParse(idempotencyKey);

  if (!parsedIdempotencyKey.success) {
    throw new ApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key es obligatorio y debe tener entre 8 y 200 caracteres seguros",
    );
  }

  return {
    requestId: parsedRequestId.data,
    idempotencyKey: parsedIdempotencyKey.data,
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();

    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(object[key])}`,
      )
      .join(",")}}`;
  }

  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError(
      "No se puede canonicalizar un valor JSON no serializable",
    );
  }

  return serialized;
}

export function hashMutationRequest(
  operation: string,
  body: unknown,
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        operation,
        body,
      }),
      "utf8",
    )
    .digest("hex");
}
