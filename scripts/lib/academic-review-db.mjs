import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
export const read = path => readFileSync(new URL(path, root), 'utf8');
export const reviewMigration = 'supabase/raes/migrations/20261109161812_academic_review.sql';
export async function createReviewDb({ beforeReview } = {}) {
 const db = await PGlite.create({ extensions: { pgcrypto } });
 try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
   grant usage on schema public,auth to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  const manifest = JSON.parse(read('supabase/raes/bootstrap/manifest.json'));
  for (const item of manifest.files) {
   const sql=read(`supabase/raes/bootstrap/${item.file}`);
   if (createHash('sha256').update(sql).digest('hex') !== item.sha256) throw Error('Historical DDL checksum changed');
   await db.exec(sql);
  }
  for (const name of readdirSync(new URL('supabase/raes/migrations/',root)).sort()) {
   if (name==='20261109161812_academic_review.sql' && beforeReview) await beforeReview(db);
   await db.exec(read(`supabase/raes/migrations/${name}`));
  }
  return db;
 } catch(error) { await db.close(); throw error; }
}
