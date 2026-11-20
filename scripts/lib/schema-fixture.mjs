import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
export const readProjectFile = path => readFileSync(new URL(path, root), "utf8");
export async function reconstructSchema(project, { stage = "current", beforeAcademicReview } = {}) {
  const manifest = JSON.parse(readProjectFile("supabase/bootstrap/manifest.json"));
  if (!["hardening", "academic", "current"].includes(stage) || !manifest.projects[project]) throw new Error("Unsupported reconstruction stage/project");
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
    if (stage !== "hardening") {
      const migrations = manifest.academicReviewMigrations.filter(m => m.project === project);
      if (migrations.length && beforeAcademicReview) await beforeAcademicReview(db);
      for (const migration of migrations) {
        const sql = readProjectFile(migration.file);
        if (createHash("sha256").update(sql).digest("hex") !== migration.sha256) throw new Error("Academic DDL checksum mismatch");
        await db.exec(sql);
      }
    }
    if (stage === "current") for (const migration of manifest.productionMigrations ?? []) {
      if (migration.project !== project) continue;
      const sql = readProjectFile(migration.file);
      if (createHash("sha256").update(sql).digest("hex") !== migration.sha256) throw new Error("Production DDL checksum mismatch");
      await db.exec(sql);
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}
