export type WebAuthConfig = {
  url: string;
  publishableKey: string;
  apiBase: string;
  cookieName: string;
};
export function readWebConfig(
  env: Record<string, string | undefined>,
  product: "RAES" | "CREDENLY",
): WebAuthConfig {
  const prefix = `${product}_WEB_`;
  const url = env[`${prefix}SUPABASE_URL`];
  const key = env[`${prefix}SUPABASE_PUBLISHABLE_KEY`];
  const api = env[`${product}_API_BASE_URL`];
  if (!url || !key || !api)
    throw new Error(
      "Configuración web incompleta. Revisa el archivo .env.local de esta aplicación.",
    );
  if (
    new URL(url).protocol !== "https:" ||
    !["http:", "https:"].includes(new URL(api).protocol)
  )
    throw new Error("La configuración web requiere URLs válidas.");
  let isAnon = false;
  try {
    isAnon =
      JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())
        .role === "anon";
  } catch {
    /* Publishable keys are not JWTs. */
  }
  if (!key.startsWith("sb_publishable_") && !isAnon)
    throw new Error(
      "Usa únicamente una clave publishable/anon. No se admite service_role.",
    );
  return {
    url,
    publishableKey: key,
    apiBase: api,
    cookieName: `${product.toLowerCase()}-web-auth`,
  };
}
