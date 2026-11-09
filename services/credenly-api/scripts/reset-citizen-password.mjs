import { writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

// Operator-only recovery. Password input is hidden and stays only in memory.
// No HTTP endpoint, account creation, profile/identity writes or email confirmation.
class ResetError extends Error {}
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const expectedArg = args.find(arg => arg.startsWith("--expected-user-id="));
const expectedId = expectedArg?.slice("--expected-user-id=".length);
const positional = args.filter((arg) => arg !== "--check" && arg !== expectedArg);
let password;
let confirmation;
let sessionClient;
let updated = false;

async function main() {
  if (positional.length !== 2 || positional[0] !== "--email" || !/^\S+@\S+\.\S+$/.test(positional[1])) {
    throw new ResetError("Uso: pnpm --filter @credenly/api citizen:reset-password --email cuenta@dominio [--check]");
  }
  if (!checkOnly && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new ResetError("Ejecuta el comando en tu terminal interactiva. No se acepta contraseña por pipes ni argumentos.");
  }
  const email = positional[1].toLowerCase();
  const url = process.env.CREDENLY_SUPABASE_URL;
  const key = process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).protocol !== "https:") throw new ResetError("Revisa la configuración local de Credenly API.");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) },
  };
  const db = createClient(url, key, options);
  let account;
  for (let page = 1; page <= 20; page++) {
    const result = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new ResetError("No fue posible comprobar las cuentas de Credenly Auth.");
    account = result.data.users.find((user) => user.email?.toLowerCase() === email);
    if (account || result.data.users.length < 100) break;
  }
  if (!account) throw new ResetError("No se encontró esa cuenta existente en Credenly Auth. No se creará una nueva.");
  if (expectedId && account.id !== expectedId) throw new ResetError("El UUID de la cuenta no corresponde al objetivo autorizado. No se realizó el cambio.");
  if (!account.email_confirmed_at) throw new ResetError("La cuenta aún no tiene correo confirmado. Este comando no omite esa confirmación.");
  async function citizenState() {
    const [profile, link] = await Promise.all([
      db.from("perfiles").select("*").eq("id", account.id).single(),
      db.from("vinculaciones_raes").select("*").eq("usuario_id", account.id).maybeSingle(),
    ]);
    if (profile.error || link.error) throw new ResetError("No fue posible comprobar el perfil y la vinculación de la cuenta.");
    const verification = await db.from("verificaciones_identidad").select("*").eq("usuario_id",account.id).order("id");
    const shares = await db.from("comparticiones").select("*").eq("usuario_id",account.id).order("id");
    if(verification.error || shares.error)throw new ResetError("No fue posible comprobar las verificaciones y comparticiones.");
    const shareIds=shares.data.map(s=>s.id);
    const accesses=shareIds.length?await db.from("accesos_compartidos").select("*").in("comparticion_id",shareIds).order("id"):{data:[],error:null};
    if(accesses.error)throw new ResetError("No fue posible comprobar los accesos compartidos.");
    return JSON.stringify({ profile:profile.data,link:link.data,verifications:verification.data,shares:shares.data,accesses:accesses.data });
  }
  const before = await citizenState();
  console.log(`Cuenta: ${email} · Credenly · ${new URL(url).hostname}`);
  if (checkOnly) {
    console.log("Cuenta confirmada y perfil localizado. No se cambió ninguna contraseña.");
    return;
  }
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
  const currentAccount = await db.auth.admin.getUserById(account.id);
  if (currentAccount.error || currentAccount.data.user.email?.toLowerCase() !== email || !currentAccount.data.user.email_confirmed_at || await citizenState() !== before) {
    throw new ResetError("La cuenta o los datos ciudadanos cambiaron durante la operación. No se realizó el restablecimiento.");
  }
  const result = await db.auth.admin.updateUserById(account.id, { password });
  if (result.error) throw new ResetError("Supabase rechazó el cambio de contraseña. Revisa su política de contraseñas e intenta de nuevo.");
  updated = true;
  sessionClient = createClient(url, key, options);
  const login = await sessionClient.auth.signInWithPassword({ email, password });
  password = undefined; confirmation = undefined;
  if (login.error || login.data.user?.id !== account.id || !login.data.session) {
    throw new ResetError("La contraseña se cambió, pero no fue posible verificar el inicio de sesión. No repitas el cambio automáticamente.");
  }
  if (await citizenState() !== before) throw new ResetError("La contraseña se cambió; se requiere revisar el perfil y la vinculación.");
  writeFileSync("/tmp/valentina-password-reset-result.json",JSON.stringify({verifiedAt:new Date().toISOString(),userId:account.id,passwordReset:true,loginVerified:true,citizenRelationsUnchanged:true,academicWrites:0},null,2)+"\n",{mode:0o600});
  console.log("Contraseña restablecida e inicio de sesión verificado. Perfil, verificación, vinculación, comparticiones y accesos conservados.");
}
try { await main(); }
catch (error) {
  const safe = error instanceof ResetError ? error.message : "No fue posible completar la operación. Revisa la conexión antes de volver a intentar.";
  console.error(updated ? `El cambio de contraseña ya se realizó. ${safe}` : safe);
  process.exitCode = 1;
} finally {
  password = undefined; confirmation = undefined;
  if (sessionClient) {
    try {
      const result = await sessionClient.auth.signOut({ scope: "local" });
      if (result.error) { console.error("No se pudo confirmar el cierre de la sesión de comprobación."); process.exitCode = 1; }
    } catch { console.error("No se pudo confirmar el cierre de la sesión de comprobación."); process.exitCode = 1; }
  }
}
