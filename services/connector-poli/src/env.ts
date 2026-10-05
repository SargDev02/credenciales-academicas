import { config } from "dotenv";
import { z } from "zod";

config({
  path: process.env.CONNECTOR_ENV_FILE ?? "services/connector-poli/.env.local",
});

const envSchema = z.object({
  POLI_SUPABASE_URL: z.string().url(),
  POLI_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RAES_API_BASE_URL: z.string().url(),
  RAES_POLI_CLIENT_ID: z.string().min(10),
  RAES_POLI_CLIENT_SECRET: z.string().min(20),
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
