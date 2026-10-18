import { RaesClient as CoreClient } from "@raes/connector-core";
import type { ConnectorEnv } from "./env";
export { RaesApiError } from "@raes/connector-core";
export class RaesClient extends CoreClient {
  constructor(env: ConnectorEnv) {
    super({ baseUrl: env.RAES_API_BASE_URL, clientId: env.RAES_UDEA_CLIENT_ID, clientSecret: env.RAES_UDEA_CLIENT_SECRET, namespace: "udea" });
  }
}
