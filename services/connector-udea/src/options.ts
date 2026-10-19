import type { SyncMode } from "./sync";

export function parseArgs(args: string[]): {
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

      if (value !== "all" && value !== "base" && value !== "credentials") {
        throw new Error("--only debe ser all, base o credentials");
      }

      mode = value;
    } else if (arg.startsWith("--credential-code=")) {
      credentialCode = arg.slice("--credential-code=".length).trim() || null;
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  return { mode, credentialCode };
}
