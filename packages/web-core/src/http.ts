export class WebApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(publicErrorMessage(status));
    this.name = "WebApiError";
  }
}
export function publicErrorMessage(status: number): string {
  if (status === 400) return "Revisa los datos y los permisos solicitados.";
  if (status === 401) return "Tu sesión terminó. Vuelve a iniciar sesión.";
  if (status === 403)
    return "Tu cuenta no tiene permiso para acceder a esta sección.";
  if (status === 404) return "No encontramos el recurso solicitado.";
  if (status === 409)
    return "La operación entra en conflicto con un registro existente.";
  if (status === 429) return "Hay demasiadas solicitudes. Espera un momento.";
  if (status === 504)
    return "El servicio tardó demasiado en responder. Intenta de nuevo.";
  return "No fue posible completar la solicitud. Intenta de nuevo.";
}
export async function apiRequest<T>(
  base: string,
  path: string,
  options: {
    token?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    validate: (value: unknown) => value is T;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  },
): Promise<T> {
  if (!path.startsWith("/api/v1/") || path.includes("\\") || path.includes("?"))
    throw new Error("Invalid API path");
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 8000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  try {
    const response = await fetch(new URL(path, base), {
      method: options.method ?? "GET",
      ...(options.body !== undefined
        ? {
            body:
              options.body instanceof FormData
                ? options.body
                : JSON.stringify(options.body),
          }
        : {}),
      headers: {
        Accept: "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        ["SHARE_REVOKED", "SHARE_EXPIRED", "RAES_LINK_REQUIRED"].includes(
          String(payload.error),
        )
          ? String(payload.error)
          : "API_REQUEST_FAILED";
      throw new WebApiError(response.status, code);
    }
    if (!options.validate(payload))
      throw new WebApiError(502, "INVALID_RESPONSE");
    return payload;
  } catch (error) {
    if (error instanceof WebApiError) throw error;
    if (options.signal?.aborted) throw new WebApiError(499, "ABORTED");
    if (timeout.aborted) throw new WebApiError(504, "TIMEOUT");
    throw new WebApiError(502, "UNAVAILABLE");
  }
}
export function safeReturnPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : fallback;
}
