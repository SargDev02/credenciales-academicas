import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {reconstructSchema} from '../lib/schema-fixture.mjs';
import {fixture,baseline,beginDetection,submit,observation,decision} from '../lib/academic-review-fixture.mjs';

async function databaseSnapshot(db){
 const rows=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows,result={};
 for(const {tablename}of rows)result[tablename]=(await db.query('select to_jsonb(t) data from public."'+tablename.replaceAll('"','""')+'" t order by to_jsonb(t)::text')).rows;
 return result;
}
test('isolated physical backup/restore preserves RAES history/guards and Credenly Auth UUID/relations',async()=>{
 for(const project of ['raes','credenly']){
  const db=project==='raes'?await fixture():await reconstructSchema(project);let restored;
  try{
   if(project==='raes'){
    await baseline(db);const lease=await beginDetection(db),o=observation();o.credenciales[0].contenido.titulo='Synthetic backup B';
    const proposal=(await submit(db,o,lease)).observaciones.find(r=>r.nueva);await decision(db,proposal.id);
   }else{
    await db.exec("insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');insert into perfiles(id,nombres,apellidos) values('00000000-0000-4000-8000-000000000001','Synthetic','Restore');insert into verificaciones_identidad(id,usuario_id,estado) values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','APROBADA');insert into vinculaciones_raes(usuario_id,raes_persona_id,verificacion_identidad_id,estado) values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','VERIFICADA')");
   }
   if(project==='credenly')await db.exec("insert into comparticiones(id,usuario_id,raes_credencial_id,token_prefix,token_hash,campos_visibles,expires_at) values('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','synthetic-prefix',repeat('a',64),'[]',now()+interval '1 day');insert into accesos_compartidos(comparticion_id,resultado,ip_hash,user_agent) values('00000000-0000-4000-8000-000000000004','OK',repeat('b',64),'synthetic restore')");
   const authBefore=(await db.query('select * from auth.users order by id')).rows;
   const before=await databaseSnapshot(db);
   const archive=await db.dumpDataDir('gzip');await db.close();
   restored=await PGlite.create({loadDataDir:archive,extensions:{pgcrypto}});
   assert.deepEqual((await restored.query('select * from auth.users order by id')).rows,authBefore);
   const after=await databaseSnapshot(restored);
   assert.deepEqual(after,before);
   if(project==='raes'){
    await restored.exec('begin;set local role service_role');await assert.rejects(restored.query('update credenciales set version_actual=9'),/REVIEW_APPROVAL_REQUIRED/);await restored.exec('rollback');
   }else assert.equal((await restored.query('select count(*)::int n from perfiles_admin a join perfiles c using(id)')).rows[0].n,0);
  }finally{await restored?.close();if(!db.closed)await db.close();}
 }
});
