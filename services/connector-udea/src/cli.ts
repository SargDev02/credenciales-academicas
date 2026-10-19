import { getConnectorEnv } from "./env";
import { RaesClient } from "./raes-client";
import {
  createInstitutionSourceClient,
  readInstitutionalSnapshot,
} from "./source";
import {
  synchronize,
  type SyncMode,
} from "./sync";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const env = getConnectorEnv();
  const source = createInstitutionSourceClient(env);
  const raes = new RaesClient(env);

  console.log("Conector Universidad de Antioquia: leyendo base académica...");
  const snapshot = await readInstitutionalSnapshot(source);

  console.log(
    `Datos leídos: ${snapshot.campuses.length} sedes, ${snapshot.programs.length} programas, ${snapshot.students.length} estudiantes, ${snapshot.credentials.length} credenciales.`,
  );

  const summary = await synchronize(snapshot, raes, options);

  console.log("Sincronización completada.");
  console.log(JSON.stringify(summary, null, 2));
  if (summary.terminalStateConflicts.length > 0) process.exitCode = 1;

  if (summary.existingCredentialsNotAdopted.length > 0) {
    console.warn(
      "Advertencia: algunas credenciales ya existían en RAES con una operación externa al conector. No fueron modificadas automáticamente:",
      summary.existingCredentialsNotAdopted.join(", "),
    );
  }
}

function parseArgs(args: string[]): {
  mode: SyncMode;
  credentialCode: string | null;
} {
  let mode: SyncMode = "all";
  let credentialCode: string | null = null;

  for (const arg of args) {
    if (arg === "--") {
      continue;
    }

    if (arg.startsWith("--only=")) {
      const value = arg.slice("--only=".length);

      if (
        value !== "all" &&
        value !== "base" &&
        value !== "credentials"
      ) {
        throw new Error(
          "--only debe ser all, base o credentials",
        );
      }

      mode = value;
    } else if (arg.startsWith("--credential-code=")) {
      credentialCode =
        arg.slice("--credential-code=".length).trim() || null;
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  return { mode, credentialCode };
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
