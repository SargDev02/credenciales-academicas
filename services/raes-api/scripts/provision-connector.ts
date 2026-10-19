import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";
import { generateClientId, generateClientSecret, getSecretLookupPrefix, hashClientSecret } from "../src/lib/api-credentials";
import { institutionAScopes } from "../src/lib/scopes";

// Operator-only server tool. No admin impersonation; no secret output.
const [envArg, prefix] = process.argv.slice(2);
if (!envArg || !prefix || !/^[A-Z]+$/.test(prefix)) throw new Error("Usage: provision-connector.ts SOURCE_ENV_FILE PREFIX");
const envPath = resolve(envArg);
const original = readFileSync(envPath, "utf8");
const env = parse(original);
const url = env[`${prefix}_SUPABASE_URL`];
const key = env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
if (!url || !key) throw new Error("Missing source configuration");
const source = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error: sourceError } = await source.from("institucion").select("nit,codigo_snies,nombre,tipo_institucion,estado").limit(2);
if (sourceError || rows?.length !== 1) throw new Error("Source institution unavailable or ambiguous");
const institution = rows[0]!;
const db = getRaesSupabaseAdmin();
const existing = await db.from("instituciones").select("id").eq("nit", institution.nit).maybeSingle();
if (existing.error) throw new Error("Institution lookup failed");
let institutionId = existing.data?.id as string | undefined;
if (!institutionId) {
  const created = await db.from("instituciones").insert(institution).select("id").single();
  if (created.error || !created.data) throw new Error("Institution provisioning failed");
  institutionId = created.data.id;
}
const name = `Conector ${prefix === "POLI" ? "Politécnico" : institution.nombre}`;
const integrations = await db.from("integraciones_institucionales").select("id,client_id")
  .eq("institucion_id", institutionId).eq("nombre", name).maybeSingle();
if (integrations.error) throw new Error("Integration lookup failed");
let integration = integrations.data;
if (!integration) {
  const clientId = generateClientId();
  const secret = generateClientSecret();
  const created = await db.rpc("aprovisionar_integracion_institucional", {
    p_institucion_id: institutionId, p_nombre: name, p_client_id: clientId,
    p_key_prefix: getSecretLookupPrefix(secret), p_secret_hash: hashClientSecret(secret),
    p_scope_codes: institutionAScopes,
  });
  if (created.error || !created.data?.[0]) throw new Error("Integration provisioning failed");
  integration = created.data[0];
  writeFileSync(envPath, original.trimEnd() + `\nRAES_${prefix}_CLIENT_ID=${clientId}\nRAES_${prefix}_CLIENT_SECRET=${secret}\n`, { mode: 0o600 });
  chmodSync(envPath, 0o600);
} else if (env[`RAES_${prefix}_CLIENT_ID`] !== integration.client_id || !env[`RAES_${prefix}_CLIENT_SECRET`]) {
  throw new Error("Existing credentials absent locally; refusing implicit secret rotation");
}
if (!integration) throw new Error("Missing integration result");
const scopes = await db.from("scopes").select("id,codigo").in("codigo", institutionAScopes);
if (scopes.error || scopes.data?.length !== institutionAScopes.length) throw new Error("Scope catalog incomplete");
const grants = await db.from("integracion_scopes").upsert(scopes.data.map(s => ({ integracion_id: integration.id, scope_id: s.id })), { onConflict: "integracion_id,scope_id" });
if (grants.error) throw new Error("Scope assignment failed");
const audit = await db.from("auditoria").insert({ actor_tipo: "SISTEMA", accion: "CONECTOR_APROVISIONADO", recurso_tipo: "INTEGRACION_INSTITUCIONAL", recurso_id: integration.id, metadata: { institutionId, scopes: institutionAScopes, source: "operator-cli" } });
if (audit.error) throw new Error("Provisioning audit failed");
console.log(JSON.stringify({ institution: institution.nombre, integrationReady: true, scopes: institutionAScopes, secretsPrinted: false }));
