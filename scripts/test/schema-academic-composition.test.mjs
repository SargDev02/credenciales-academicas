import test from "node:test";
import assert from "node:assert/strict";
import { reconstructSchema, readProjectFile } from "../lib/schema-fixture.mjs";

test("archive -> hardening #16 -> review #17 reconstructs restrictive current RAES from zero", async () => {
  const db = await reconstructSchema("raes");
  try {
    await db.exec(readProjectFile("supabase/tests/browser_privileges.sql"));
    assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n,0);
    const expectedGrants = JSON.parse(readProjectFile("docs/reports/evidence/predeploy-db-post-catalog.json")).projects.raes.catalog.grants
      .filter(row => ["anon", "authenticated"].includes(row.role));
    const actualGrants = (await db.query("select grantee as role,table_name as table,privilege_type as privilege from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')")).rows;
    const sorted = rows => rows.map(row => `${row.role}/${row.table}/${row.privilege}`).sort();
    assert.deepEqual(sorted(actualGrants),sorted(expectedGrants));
    const rows = (await db.query(`select c.relname, c.relrowsecurity as rls,
      has_table_privilege('anon',c.oid,'select,insert,update,delete,truncate') as anon_access,
      has_table_privilege('authenticated',c.oid,'select,insert,update,delete,truncate') as browser_access,
      has_table_privilege('service_role',c.oid,'insert,update,delete,truncate') as direct_write
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('cortes_revision_academica','huellas_baseline_revision_academica','origenes_revision_academica','solicitudes_revision_academica','detecciones_revision_academica') order by c.relname`)).rows;
    assert.equal(rows.length, 5);
    for (const r of rows) assert.deepEqual([r.rls,r.anon_access,r.browser_access,r.direct_write],[true,false,false,false]);
    const functions = (await db.query(`select p.proname,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as browser_execute,has_function_privilege('service_role',p.oid,'execute') as backend_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('presentar_revision_academica','decidir_revision_academica','controlar_deteccion_academica','preparar_baseline_revision_academica','listar_revisiones_academicas','obtener_revision_academica','registrar_credencial_inicial','corregir_credencial','transicionar_estado_credencial','academic_review_apply_credential')`)).rows;
    assert.equal(functions.length, 10);
    for (const f of functions) {
      assert.equal(f.anon_execute,false);assert.equal(f.browser_execute,false);
      assert.equal(f.backend_execute,['presentar_revision_academica','decidir_revision_academica','controlar_deteccion_academica','preparar_baseline_revision_academica','listar_revisiones_academicas','obtener_revision_academica'].includes(f.proname));
    }
    assert.equal((await db.query("select count(*)::int n from solicitudes_revision_academica")).rows[0].n,0);
    await db.exec("begin;set local role service_role");
    await assert.rejects(db.query("insert into personas_maestra default values"),/REVIEW_APPROVAL_REQUIRED/);
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::int n from personas_maestra")).rows[0].n,0);
  } finally { await db.close(); }
});
