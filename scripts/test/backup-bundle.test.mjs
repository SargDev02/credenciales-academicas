import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {verifyBackupBundle} from '../verify-backup-bundle.mjs';
test('backup inventory requires DB/Auth/configuration/external secret references and detects corruption without printing content',async()=>{
 const root=mkdtempSync(join(tmpdir(),'backup-verification-'));try{
  const files=['database','auth','configuration','external-secret-references'].map(kind=>{writeFileSync(join(root,kind),'SYNTHETIC');return {kind,path:kind,sha256:createHash('sha256').update('SYNTHETIC').digest('hex')};});
  const manifest=join(root,'manifest.json');writeFileSync(manifest,JSON.stringify({version:1,product:'RAES',files}));assert.equal((await verifyBackupBundle(manifest)).result,'PASS');
  writeFileSync(join(root,'auth'),'CORRUPTED');await assert.rejects(verifyBackupBundle(manifest),/BACKUP_INTEGRITY_FAILED/);
  writeFileSync(manifest,JSON.stringify({version:1,product:'RAES',files:[]}));await assert.rejects(verifyBackupBundle(manifest),/INCOMPLETE_BACKUP_BUNDLE/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
