import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstructSchema } from '../lib/schema-fixture.mjs';
for(const project of ['raes','credenly'])test(`${project} distributed counters arbitrate replicas and are inaccessible to browser/direct service writes`,async()=>{
 const db=await reconstructSchema(project);try{
  const privileges=(await db.query("select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') a,has_function_privilege('authenticated',p.oid,'EXECUTE') u,has_function_privilege('service_role',p.oid,'EXECUTE') s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consume_production_limit','manage_raes_secret','maintain_credenly_privacy')")).rows;
  assert.equal(privileges.length,2);for(const row of privileges)assert.deepEqual([row.a,row.u,row.s],[false,false,true]);
  const call=()=>db.query("select public.consume_production_limit('login',repeat('a',64),3,60) r");
  for(let i=0;i<3;i++)assert.equal((await call()).rows[0].r.allowed,true);
  assert.equal((await call()).rows[0].r.allowed,false);
  await db.exec("begin;set local role authenticated");await assert.rejects(call(),/permission denied/);await db.exec('rollback');
  await db.exec("begin;set local role service_role");await assert.rejects(db.query('delete from public.production_rate_limits'),/permission denied/);await db.exec('rollback');
  await db.exec("update production_rate_limits set resets_at=now()-interval '1 second'");assert.equal((await call()).rows[0].r.allowed,true);
  assert.equal((await db.query('select count(*)::int n from production_rate_limits')).rows[0].n,1);
 }finally{await db.close();}
});
test('retention is dry-run by default, preserves identity/link/structured data and excludes pending OCR',async()=>{
 const db=await reconstructSchema('credenly');try{
  await db.exec("insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');insert into verificaciones_identidad(usuario_id,estado,processed_at,texto_extraido) values('00000000-0000-4000-8000-000000000001','APROBADA',now()-interval '90 days','synthetic text'),('00000000-0000-4000-8000-000000000001','REVISION',now()-interval '90 days','pending synthetic text')");
  const call=execute=>db.query("select public.maintain_credenly_privacy(now()-interval '30 days','RESOLVED_OCR_TEXT',$1,100) r",[execute]);
  assert.equal((await call(false)).rows[0].r.selected,1);assert.equal((await db.query('select count(*)::int n from verificaciones_identidad where texto_extraido is not null')).rows[0].n,2);
  assert.equal((await call(true)).rows[0].r.executed,true);assert.equal((await db.query('select count(*)::int n from verificaciones_identidad')).rows[0].n,2);
  assert.equal((await db.query("select texto_extraido from verificaciones_identidad where estado='REVISION'")).rows[0].texto_extraido,'pending synthetic text');
  await assert.rejects(db.query("select maintain_credenly_privacy(now(),'RESOLVED_OCR_TEXT',true,100)"),/INVALID_RETENTION_WINDOW/);
 }finally{await db.close();}
});

test('secret prepare/revoke keeps owner, scopes, old key until explicit revoke and canonical history intact',async()=>{
 const {fixture,ids,snapshot}=await import('../lib/academic-review-fixture.mjs');
 const db=await fixture();try{
  const before=await snapshot(db);
  const prepare=prefix=>db.query("select manage_raes_secret('INTEGRATION',$1,'PREPARE',null,$2,repeat('a',64)) id",[ids.integration,prefix]);
  const old=(await prepare('raes_sk_aaaaaaaaaaaa')).rows[0].id,newId=(await prepare('raes_sk_bbbbbbbbbbbb')).rows[0].id;
  assert.notEqual(old,newId);assert.equal((await db.query('select count(*)::int n from integracion_secretos where revoked_at is null')).rows[0].n,2);
  await assert.rejects(db.query("select manage_raes_secret('INTEGRATION',$1,'REVOKE',$2)",[ids.otherIntegration,old]),/SECRET_NOT_FOUND/);
  await db.query("select manage_raes_secret('INTEGRATION',$1,'REVOKE',$2)",[ids.integration,old]);
  assert.equal((await db.query('select count(*)::int n from integracion_secretos where revoked_at is null')).rows[0].n,1);
  assert.deepEqual(await snapshot(db),before);
  await db.exec('begin;set local role authenticated');await assert.rejects(prepare('raes_sk_cccccccccccc'),/permission denied/);await db.exec('rollback');
 }finally{await db.close();}
});
