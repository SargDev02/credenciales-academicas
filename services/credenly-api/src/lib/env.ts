import { z } from "zod";

const serverEnvSchema = z.object({
  CREDENLY_SUPABASE_URL: z.string().url(),
  CREDENLY_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = serverEnvSchema.safeParse({
    CREDENLY_SUPABASE_URL: process.env.CREDENLY_SUPABASE_URL,
    CREDENLY_SUPABASE_SERVICE_ROLE_KEY:
      process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    const invalidFields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean);

    throw new Error(
      `Configuración de Credenly API inválida: ${invalidFields.join(", ")}`,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}
