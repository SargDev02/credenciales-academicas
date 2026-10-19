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
    token: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    validate: (value: unknown) => value is T;
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
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${options.token}`,
      },
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok)
      throw new WebApiError(response.status, "API_REQUEST_FAILED");
    const payload: unknown = await response.json();
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
