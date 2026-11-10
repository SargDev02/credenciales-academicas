import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
export const readProjectFile = path => readFileSync(new URL(path, root), "utf8");
export async function reconstructSchema(project) {
  const manifest = JSON.parse(readProjectFile("supabase/bootstrap/manifest.json"));
  const db = await PGlite.create({ extensions: { pgcrypto } });
  try {
    // Test-only platform substrate. No GoTrue, JWT issuer, email or network.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema extensions;
      create extension pgcrypto with schema extensions;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      grant usage on schema public, auth to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
    `);
    for (const migration of manifest.projects[project]) await db.exec(readProjectFile(`supabase/bootstrap/${project}/${migration.file}`));
    for (const migration of manifest.postBaselineMigrations.filter(m => m.project === project)) await db.exec(readProjectFile(migration.file));
    if (project === "raes") await db.exec(readProjectFile("supabase/bootstrap/raes/scopes.sql"));
    return db;
  } catch (error) { await db.close(); throw error; }
}
