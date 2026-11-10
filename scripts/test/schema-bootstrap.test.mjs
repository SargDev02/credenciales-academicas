import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { reconstructSchema, readProjectFile } from "../lib/schema-fixture.mjs";
const manifest = JSON.parse(readProjectFile("supabase/bootstrap/manifest.json"));
const reference = JSON.parse(readProjectFile("docs/reports/evidence/predeploy-db-post-catalog.json")).projects;
for (const project of ["raes", "credenly", "poli", "udea"]) test(`empty PostgreSQL/WASM reconstructs ${project} DDL and security constraints`, async () => {
  const db = await reconstructSchema(project);
  try {
    const actual = await db.query(`select c.relname as name,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`);
    assert.deepEqual(actual.rows, reference[project].catalog.tables.map(t => ({ name: t.name, rls: t.rls })));
    const columns = await db.query("select table_name as table,column_name as name,udt_name as type,is_nullable as nullable,column_default as default from information_schema.columns where table_schema='public' order by table_name,ordinal_position");
    assert.deepEqual(columns.rows, reference[project].catalog.columns.map(({ table, name, type, nullable, default: value }) => ({ table, name, type, nullable, default: value })));
    const constraints = await db.query(`select conrelid::regclass::text as table,conname as name,contype as kind,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype <> 'n' order by conrelid::regclass::text,conname`);
    assert.deepEqual(constraints.rows, reference[project].catalog.constraints.map(({ table, name, kind, definition }) => ({ table, name, kind, definition })));
    const indexes = await db.query("select tablename as table,indexname as name,indexdef as definition from pg_indexes where schemaname='public' order by tablename,indexname");
    assert.deepEqual(indexes.rows, reference[project].catalog.indexes.map(({ table, name, definition }) => ({ table, name, definition })));
    const triggers = await db.query(`select t.tgrelid::regclass::text as table,t.tgname as name,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by t.tgrelid::regclass::text,t.tgname`);
    assert.deepEqual(triggers.rows, reference[project].catalog.triggers);
    const functions = await db.query(`select p.proname as name,pg_get_function_identity_arguments(p.oid) as identity,pg_get_function_result(p.oid) as result,p.prosecdef as "securityDefiner",p.proconfig as config from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname,p.oid`);
    assert.deepEqual(functions.rows, reference[project].catalog.functions.map(({ name, identity, result, securityDefiner, config }) => ({ name, identity, result, securityDefiner, config })));
    const bodies = await db.query(`select p.proname as name,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') as sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname`);
    assert.deepEqual(bodies.rows, manifest.functionBodySha256[project]);
    const policies = await db.query(`select tablename as table,policyname as name,roles,cmd as command,qual as using,with_check as check from pg_policies where schemaname='public' order by tablename,policyname`);
    assert.deepEqual(policies.rows, reference[project].catalog.policies ?? []);
    await db.exec(readProjectFile("supabase/tests/browser_privileges.sql"));
    if (project === "credenly") await db.exec(`
      insert into auth.users(id) values('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102');
      insert into public.perfiles(id,nombres,apellidos) values('00000000-0000-4000-8000-000000000101','Synthetic','Citizen');
      insert into public.perfiles_admin(id,nombres,apellidos) values('00000000-0000-4000-8000-000000000102','Synthetic','Operator');
    `);
    if (["raes", "credenly"].includes(project)) {
      for (const file of readdirSync(new URL(`../../supabase/${project}/tests/`, import.meta.url)).filter(f => f.endsWith(".sql") && !f.includes("existing_data"))) await db.exec(readProjectFile(`supabase/${project}/tests/${file}`));
    }
  } finally { await db.close(); }
});
