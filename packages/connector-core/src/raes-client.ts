import type {
  AnulacionCredencial,
  CorreccionCredencial,
  CredencialNueva,
  Institucion,
  Persona,
  Programa,
  ProgramaSede,
  RevocacionCredencial,
  Sede,
} from "@raes/contracts";

export type RaesConnectorConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  namespace: string;
};
export type CredentialSyncState = {
  state: "VIGENTE" | "REVOCADA" | "ANULADA";
  version: number;
  creationKey: string | null;
  personSourceIds: string[];
  payload: Omit<CredencialNueva, "personaIdentificadorOrigen">;
};

export class RaesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "RaesApiError";
  }
}

type MutationHeaders = {
  requestId: string;
  idempotencyKey: string;
};

export class RaesClient {
  private readonly authorization: string;
  private readonly baseUrl: string;

  readonly namespace: string;

  constructor(env: RaesConnectorConfig) {
    this.namespace = env.namespace;
    this.baseUrl = env.baseUrl.replace(/\/$/, "");
    this.authorization =
      `Bearer ${env.clientId}.${env.clientSecret}`;
  }

  async getCredentialState(code: string): Promise<CredentialSyncState | null> {
    try {
      const result = await this.request("GET", `/api/v1/credentials/source/${encodeURIComponent(code)}`) as { data: CredentialSyncState };
      return result.data;
    } catch (error) {
      if (error instanceof RaesApiError && error.status === 404 && error.code === "CREDENTIAL_NOT_FOUND") return null;
      throw error;
    }
  }

  syncInstitution(input: Institucion): Promise<unknown> {
    return this.request("PUT", "/api/v1/sync/institution", input);
  }

  syncCampus(input: Sede): Promise<unknown> {
    return this.request("PUT", "/api/v1/sync/campuses", input);
  }

  syncProgram(input: Programa): Promise<unknown> {
    return this.request("PUT", "/api/v1/sync/programs", input);
  }

  syncProgramCampus(input: ProgramaSede): Promise<unknown> {
    return this.request(
      "PUT",
      "/api/v1/sync/program-campuses",
      input,
    );
  }

  syncPerson(input: Persona): Promise<unknown> {
    return this.request("PUT", "/api/v1/sync/persons", input);
  }

  createCredential(
    input: CredencialNueva,
    headers: MutationHeaders,
  ): Promise<unknown> {
    return this.request(
      "POST",
      "/api/v1/credentials",
      input,
      headers,
    );
  }

  correctCredential(
    input: CorreccionCredencial,
    headers: MutationHeaders,
  ): Promise<unknown> {
    return this.request(
      "POST",
      "/api/v1/credentials/corrections",
      input,
      headers,
    );
  }

  revokeCredential(
    input: RevocacionCredencial,
    headers: MutationHeaders,
  ): Promise<unknown> {
    return this.request(
      "POST",
      "/api/v1/credentials/revocations",
      input,
      headers,
    );
  }

  annulCredential(
    input: AnulacionCredencial,
    headers: MutationHeaders,
  ): Promise<unknown> {
    return this.request(
      "POST",
      "/api/v1/credentials/annulments",
      input,
      headers,
    );
  }

  private async request(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
    mutationHeaders?: MutationHeaders,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: this.authorization,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (mutationHeaders) {
      headers["X-Request-Id"] = mutationHeaders.requestId;
      headers["Idempotency-Key"] =
        mutationHeaders.idempotencyKey;
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new Error(
        `No fue posible conectar con RAES API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const payload = await parseResponse(response);

    if (!response.ok) {
      const errorPayload = payload as {
        error?: string;
        message?: string;
        details?: unknown;
      };

      throw new RaesApiError(
        response.status,
        errorPayload.error ?? "RAES_API_ERROR",
        errorPayload.message ??
          `RAES respondió HTTP ${response.status}`,
        errorPayload.details,
      );
    }

    return payload;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `RAES devolvió una respuesta no JSON (HTTP ${response.status})`,
    );
  }
}
