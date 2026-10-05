import { config } from "dotenv";

import {
  formatInstitutionBearer,
  generateClientId,
  generateClientSecret,
  getSecretLookupPrefix,
  hashClientSecret,
} from "../src/lib/api-credentials";
import {
  institutionAScopes,
  scopeCatalog,
} from "../src/lib/scopes";
import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";

config({ path: ".env.local" });

const INSTITUTION = {
  nit: "890980136-6",
  nombre: "Politécnico Colombiano Jaime Isaza Cadavid",
  tipo_institucion: "INSTITUCION_UNIVERSITARIA",
  estado: "ACTIVA",
} as const;

const INTEGRATION_NAME = "Conector Politécnico";

async function main() {
  const supabase = getRaesSupabaseAdmin();

  const { error: scopesUpsertError } = await supabase
    .from("scopes")
    .upsert(
      scopeCatalog.map((scope) => ({ ...scope })),
      { onConflict: "codigo" },
    );

  if (scopesUpsertError) {
    throw new Error(
      `No fue posible inicializar scopes: ${scopesUpsertError.message}`,
    );
  }

  const { data: existingInstitution, error: institutionLookupError } =
    await supabase
      .from("instituciones")
      .select("id,nit,nombre")
      .eq("nit", INSTITUTION.nit)
      .maybeSingle();

  if (institutionLookupError) {
    throw new Error(
      `No fue posible consultar la institución: ${institutionLookupError.message}`,
    );
  }

  let institution = existingInstitution;

  if (!institution) {
    const { data, error } = await supabase
      .from("instituciones")
      .insert(INSTITUTION)
      .select("id,nit,nombre")
      .single();

    if (error) {
      throw new Error(
        `No fue posible registrar la institución: ${error.message}`,
      );
    }

    institution = data;
  }

  const { data: existingIntegration, error: integrationLookupError } =
    await supabase
      .from("integraciones_institucionales")
      .select("id,client_id,nombre,estado")
      .eq("institucion_id", institution.id)
      .eq("nombre", INTEGRATION_NAME)
      .maybeSingle();

  if (integrationLookupError) {
    throw new Error(
      `No fue posible consultar la integración: ${integrationLookupError.message}`,
    );
  }

  let integration = existingIntegration;

  if (!integration) {
    const { data, error } = await supabase
      .from("integraciones_institucionales")
      .insert({
        institucion_id: institution.id,
        nombre: INTEGRATION_NAME,
        client_id: generateClientId(),
        estado: "ACTIVA",
      })
      .select("id,client_id,nombre,estado")
      .single();

    if (error) {
      throw new Error(
        `No fue posible crear la integración: ${error.message}`,
      );
    }

    integration = data;
  }

  if (integration.estado !== "ACTIVA") {
    throw new Error(
      `La integración existe pero su estado es ${integration.estado}`,
    );
  }

  const { data: scopeRows, error: scopeLookupError } = await supabase
    .from("scopes")
    .select("id,codigo")
    .in("codigo", institutionAScopes);

  if (scopeLookupError) {
    throw new Error(
      `No fue posible consultar scopes: ${scopeLookupError.message}`,
    );
  }

  const missingScopes = institutionAScopes.filter(
    (scope) => !scopeRows?.some((row) => row.codigo === scope),
  );

  if (missingScopes.length > 0) {
    throw new Error(
      `Faltan scopes después de inicializar: ${missingScopes.join(", ")}`,
    );
  }

  const { error: linkError } = await supabase
    .from("integracion_scopes")
    .upsert(
      (scopeRows ?? []).map((scope) => ({
        integracion_id: integration.id,
        scope_id: scope.id,
      })),
      { onConflict: "integracion_id,scope_id" },
    );

  if (linkError) {
    throw new Error(
      `No fue posible asignar scopes: ${linkError.message}`,
    );
  }

  const { data: secretRows, error: secretsError } = await supabase
    .from("integracion_secretos")
    .select("id,expires_at,revoked_at")
    .eq("integracion_id", integration.id)
    .is("revoked_at", null);

  if (secretsError) {
    throw new Error(
      `No fue posible consultar secretos: ${secretsError.message}`,
    );
  }

  const hasActiveSecret = (secretRows ?? []).some((secret) => {
    if (!secret.expires_at) {
      return true;
    }

    return new Date(secret.expires_at).getTime() > Date.now();
  });

  console.log("");
  console.log("RAES — Integración Institución A");
  console.log("--------------------------------");
  console.log(`Institución: ${institution.nombre}`);
  console.log(`Client ID: ${integration.client_id}`);
  console.log(`Scopes: ${institutionAScopes.join(", ")}`);

  if (hasActiveSecret) {
    console.log("");
    console.log(
      "La integración ya tiene un secreto activo. RAES no puede recuperarlo porque solo conserva su hash.",
    );
    console.log(
      "No se generó un secreto nuevo para evitar rotaciones accidentales.",
    );
    return;
  }

  const rawSecret = generateClientSecret();

  const { error: insertSecretError } = await supabase
    .from("integracion_secretos")
    .insert({
      integracion_id: integration.id,
      key_prefix: getSecretLookupPrefix(rawSecret),
      secret_hash: hashClientSecret(rawSecret),
      hash_algorithm: "SHA256",
    });

  if (insertSecretError) {
    throw new Error(
      `No fue posible registrar el secreto: ${insertSecretError.message}`,
    );
  }

  console.log("");
  console.log("SECRETO GENERADO — se mostrará solamente en esta ejecución:");
  console.log(`Client secret: ${rawSecret}`);
  console.log(
    `Authorization: ${formatInstitutionBearer(integration.client_id, rawSecret)}`,
  );
  console.log("");
  console.log(
    "Guarda el client ID y el secret en un archivo local seguro. No los confirmes en Git ni los compartas por chat.",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Error inesperado de bootstrap",
  );
  process.exitCode = 1;
});
