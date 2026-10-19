import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const defaultEnvPath = fileURLToPath(
  new URL("../.env.local", import.meta.url),
);

const envPath = process.env.CONNECTOR_ENV_FILE
  ? resolve(process.cwd(), process.env.CONNECTOR_ENV_FILE)
  : defaultEnvPath;

config({ path: envPath });

const envSchema = z.object({
  UDEA_SUPABASE_URL: z.string().url(),
  UDEA_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RAES_API_BASE_URL: z.string().url(),
  RAES_UDEA_CLIENT_ID: z.string().min(10),
  RAES_UDEA_CLIENT_SECRET: z.string().min(20),
});

export type ConnectorEnv = z.infer<typeof envSchema>;

export function getConnectorEnv(): ConnectorEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean);

    throw new Error(
      `Configuración incompleta del conector. Revisa: ${fields.join(", ")}`,
    );
  }

  return parsed.data;
}
