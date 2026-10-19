import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const base = new URL("../supabase/bootstrap/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));
let files = 0;
for (const [project, migrations] of Object.entries(manifest.projects)) {
  let previous = "";
  for (const migration of migrations) {
    if (migration.version <= previous || !/^\d{14}_[a-z_]+\.sql$/.test(migration.file)) throw new Error("Invalid archive ordering/path");
    const sql = readFileSync(new URL(`${project}/${migration.file}`, base));
    if (createHash("sha256").update(sql).digest("hex") !== migration.sha256) throw new Error("Historical DDL checksum mismatch");
    if (/(?:sbp_|sb_secret_|-----BEGIN .*PRIVATE KEY)/.test(sql.toString())) throw new Error("Potential secret in DDL archive");
    previous = migration.version;
    files++;
  }
  console.log(`${project}: ${migrations.length} ordered historical migrations verified`);
}
console.log(`${files} DDL archive checksums verified; this does not prove database restoration.`);
