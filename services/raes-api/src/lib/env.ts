import { z } from "zod";

const serverEnvSchema = z.object({
  RAES_SUPABASE_URL: z.string().url(),
  RAES_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = serverEnvSchema.safeParse({
    RAES_SUPABASE_URL: process.env.RAES_SUPABASE_URL,
    RAES_SUPABASE_SERVICE_ROLE_KEY:
      process.env.RAES_SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const missingOrInvalid = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean);

    throw new Error(
      `Configuración de RAES API inválida: ${missingOrInvalid.join(", ")}`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}
