import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Operator-only utility. Never accepts a password through arguments, env or files.
// No HTTP endpoint, profile writes, metadata changes or account creation.
config({ path: ".env.local", quiet: true });
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const positional = args.filter((arg) => arg !== "--check");
let password;
let confirmation;
let sessionClient;
let updated = false;
class ResetError extends Error {}

async function main() {
  if (positional.length !== 2 || positional[0] !== "--email" || !/^\S+@\S+\.\S+$/.test(positional[1])) {
    throw new ResetError("Uso: pnpm --filter @raes/api admin:reset-password --email cuenta@dominio [--check]");
  }
  if (!checkOnly && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new ResetError("Ejecuta el comando en tu terminal interactiva. No se acepta contraseña mediante pipes o argumentos.");
  }
  const email = positional[1].toLowerCase();
  const url = process.env.RAES_SUPABASE_URL;
  const key = process.env.RAES_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).protocol !== "https:") throw new ResetError("Revisa la configuración local de RAES API.");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) },
  };
  const db = createClient(url, key, options);
  // Resolve only accounts that already have an active administrative profile.
  const profiles = await db.from("perfiles_admin").select("id,nombres,apellidos,rol,estado").eq("estado", "ACTIVO");
  if (profiles.error) throw new ResetError("No fue posible comprobar los perfiles administrativos.");
  const matches = [];
  for (const profile of profiles.data) {
    const result = await db.auth.admin.getUserById(profile.id);
    if (result.error) throw new ResetError("No fue posible comprobar la cuenta administrativa.");
    if (result.data.user.email?.toLowerCase() === email) matches.push(profile);
  }
  if (matches.length !== 1) throw new ResetError("Se requiere una única cuenta existente con perfil administrativo ACTIVO para ese correo.");
  const profile = matches[0];
  console.log(`Cuenta: ${email} · ${profile.rol} · ${new URL(url).hostname}`);
  if (checkOnly) {
    console.log("Comprobación correcta. No se cambió ninguna contraseña.");
    return;
  }
  // All readline redraw/echo output is discarded. Prompts contain no secret.
  const hiddenOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const terminal = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  terminal.on("SIGINT", () => terminal.close());
  try {
    process.stdout.write("Nueva contraseña (mínimo 12 caracteres; entrada oculta): ");
    password = await terminal.question("");
    process.stdout.write("\nRepite la contraseña (entrada oculta): ");
    confirmation = await terminal.question("");
    process.stdout.write("\n");
  } finally { terminal.close(); hiddenOutput.end(); }
  if (password.length < 12 || password.length > 256 || !password.trim() || password !== confirmation) {
    throw new ResetError("Las contraseñas deben coincidir y tener entre 12 y 256 caracteres. No se realizó el cambio.");
  }
  // Recheck the exact target after user input, before the sole mutation.
  const current = await db.from("perfiles_admin").select("id,nombres,apellidos,rol,estado").eq("id", profile.id).single();
  const account = await db.auth.admin.getUserById(profile.id);
  if (current.error || JSON.stringify(current.data) !== JSON.stringify(profile) || account.error || account.data.user.email?.toLowerCase() !== email) {
    throw new ResetError("La cuenta o el perfil cambiaron durante la operación. No se realizó el restablecimiento.");
  }
  const result = await db.auth.admin.updateUserById(profile.id, { password });
  if (result.error) throw new ResetError("Supabase rechazó el cambio de contraseña. Revisa su política de contraseñas e intenta de nuevo.");
  updated = true;
  sessionClient = createClient(url, key, options);
  const login = await sessionClient.auth.signInWithPassword({ email, password });
  password = undefined; confirmation = undefined;
  if (login.error || login.data.user?.id !== profile.id || !login.data.session) {
    throw new ResetError("La contraseña se cambió, pero no fue posible verificar el inicio de sesión. No repitas el cambio automáticamente.");
  }
  const after = await db.from("perfiles_admin").select("id,nombres,apellidos,rol,estado").eq("id", profile.id).single();
  if (after.error || JSON.stringify(after.data) !== JSON.stringify(profile)) throw new ResetError("La contraseña se cambió; se requiere revisar el perfil administrativo.");
  console.log("Contraseña restablecida e inicio de sesión verificado. Perfil y rol conservados.");
}
try { await main(); }
catch (error) {
  // Never reflect remote errors, request payloads, session objects or credentials.
  const safe = error instanceof ResetError ? error.message
    : "No fue posible completar la operación. Revisa la conexión antes de volver a intentar.";
  console.error(updated ? `El cambio de contraseña ya se realizó. ${safe}` : safe);
  process.exitCode = 1;
} finally {
  password = undefined; confirmation = undefined;
  if (sessionClient) {
    try {
      const result = await sessionClient.auth.signOut({ scope: "local" });
      if (result.error) { console.error("El cambio se realizó; no se pudo confirmar el cierre de la sesión de comprobación."); process.exitCode = 1; }
    } catch { console.error("No se pudo confirmar el cierre de la sesión de comprobación."); process.exitCode = 1; }
  }
}
