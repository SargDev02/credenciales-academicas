import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// Read-only operator preflight. No passwords, emails or private record payloads
// are printed. This script has no update/insert/delete or Auth mutation calls.
const index = process.argv.indexOf("--user-id");
const id = index < 0 ? undefined : process.argv[index + 1];
assert.ok(
  id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    ),
  "Provide --user-id with the existing citizen UUID",
);
assert.ok(
  process.env.CREDENLY_SUPABASE_URL &&
    process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
  "Load the Credenly API server environment",
);
const db = createClient(
  process.env.CREDENLY_SUPABASE_URL,
  process.env.CREDENLY_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const account = await db.auth.admin.getUserById(id);
assert.ok(
  !account.error && account.data.user,
  "Existing account could not be read",
);
const counts: Record<string, number> = {};
for (const table of [
  "perfiles",
  "perfiles_admin",
  "verificaciones_identidad",
  "vinculaciones_raes",
  "comparticiones",
]) {
  const result = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(table.startsWith("perfiles") ? "id" : "usuario_id", id);
  assert.ok(
    !result.error && result.count !== null,
    "Read-only reference check failed",
  );
  counts[table] = result.count!;
}
assert.equal(
  counts.perfiles_admin,
  0,
  "Stop: citizen already has an administrative profile; do not change accounts",
);
console.log(
  JSON.stringify({
    mode: "READ_ONLY",
    citizenId: id,
    authPresent: true,
    emailConfirmed: !!account.data.user.email_confirmed_at,
    counts,
    accountSeparation: "BLOCKED_UNTIL_CONTROLLED_CITIZEN_EMAIL_IS_CONFIRMED",
    mutations: 0,
  }),
);
