import { getServerEnv } from "./env";

export type RaesPerson = {
  id: string;
  tipoDocumento: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
};

export type RaesCredential = {
  id: string;
  codigoRaes: string;
  tipo: string;
  categoria: string;
  estadoActual: "VIGENTE" | "REVOCADA" | "ANULADA";
  versionActual: number;
  fechaRegistroRaes: string;
  revocadaAt: string | null;
  motivoRevocacion: string | null;
  anuladaAt: string | null;
  motivoAnulacion: string | null;
  institucion:
    | {
        id: string;
        nit: string;
        nombre: string;
      }
    | null;
  programa:
    | {
        id: string;
        nombre: string;
        codigo_snies: string | null;
      }
    | null;
  sede:
    | {
        id: string;
        nombre: string;
        municipio: string | null;
      }
    | null;
  version:
    | {
        numeroVersion: number;
        tipo: string;
        categoria: string;
        titulo: string;
        descripcion: string | null;
        fechaEmision: string;
        fechaGrado: string | null;
        estadoReportado: string;
        numeroActa: string | null;
        numeroFolio: string | null;
        numeroLibro: string | null;
        createdAt: string;
      }
    | null;
};

type RaesEnvelope<T> = {
  data: T;
};

type RaesErrorEnvelope = {
  error?: string;
  message?: string;
};

export class RaesClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RaesClientError";
  }
}

export function buildRaesAuthorization(
  clientId: string,
  clientSecret: string,
): string {
  return `Bearer ${clientId}.${clientSecret}`;
}

async function raesRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const env = getServerEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set(
      "Authorization",
      buildRaesAuthorization(
        env.RAES_CREDENLY_CLIENT_ID,
        env.RAES_CREDENLY_CLIENT_SECRET,
      ),
    );

    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(
      `${env.RAES_API_BASE_URL.replace(/\/$/, "")}${path}`,
      {
        ...init,
        headers,
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | RaesEnvelope<T>
      | RaesErrorEnvelope
      | null;

    if (!response.ok) {
      const errorPayload = payload as RaesErrorEnvelope | null;

      throw new RaesClientError(
        response.status,
        errorPayload?.error ?? "RAES_REQUEST_FAILED",
        errorPayload?.message ??
          "RAES rechazó la solicitud de Credenly",
      );
    }

    if (!payload || !("data" in payload)) {
      throw new RaesClientError(
        502,
        "RAES_INVALID_RESPONSE",
        "RAES devolvió una respuesta inválida",
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof RaesClientError) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new RaesClientError(
        504,
        "RAES_TIMEOUT",
        "RAES no respondió dentro del tiempo esperado",
      );
    }

    throw new RaesClientError(
      502,
      "RAES_UNAVAILABLE",
      "No fue posible comunicarse con RAES",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type RaesClientIdentity = {
  id: string;
  clientId: string;
  nombre: string;
  tipoCliente: string;
  scopes: string[];
};

export async function getRaesClientIdentity(): Promise<RaesClientIdentity> {
  return raesRequest<RaesClientIdentity>(
    "/api/v1/auth/client-whoami",
  );
}

export async function resolveRaesPerson(input: {
  tipoDocumento: string;
  numeroDocumento: string;
}): Promise<RaesPerson> {
  return raesRequest<RaesPerson>("/api/v1/persons/resolve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getRaesCredentialsForPerson(
  raesPersonId: string,
): Promise<RaesCredential[]> {
  return raesRequest<RaesCredential[]>(
    `/api/v1/persons/${encodeURIComponent(raesPersonId)}/credentials`,
  );
}
