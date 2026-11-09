import {
  institutionalAuthErrorResponse,
} from "./institution-auth";

export type ApiErrorStatus = 400 | 403 | 404 | 409 | 413 | 500 | 503;

export class ApiError extends Error {
  constructor(
    public readonly status: ApiErrorStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
        ...(error.details === undefined
          ? {}
          : { details: error.details }),
      },
      { status: error.status },
    );
  }

  return institutionalAuthErrorResponse(error);
}
