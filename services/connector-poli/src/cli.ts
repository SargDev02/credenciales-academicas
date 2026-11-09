import { runDetection } from "@raes/connector-core";
import { getConnectorEnv } from "./env";
async function main() {
  const env = getConnectorEnv();
  await runDetection(
    { supabaseUrl: env.POLI_SUPABASE_URL, serviceRoleKey: env.POLI_SUPABASE_SERVICE_ROLE_KEY },
    { baseUrl: env.RAES_API_BASE_URL, clientId: env.RAES_POLI_CLIENT_ID, clientSecret: env.RAES_POLI_CLIENT_SECRET, namespace: "poli" },
    process.argv.slice(2),
  );
}
main().catch(error => {
  // Do not print source payloads, credentials or raw transport errors.
  console.error("La detección no terminó correctamente", { code: error && typeof error.code === "string" && /^REVIEW_[A-Z_]{1,60}$/.test(error.code) ? error.code : "DETECTION_FAILED" });
  process.exitCode = 1;
});
