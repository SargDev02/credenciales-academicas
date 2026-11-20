import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,symlinkSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeSecretFile} from '../../services/raes-api/scripts/lib/secure-output.mjs';
test('secret delivery is owner-only, outside repository, never overwrites or follows symlinks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'secure-delivery-'));try{
  mkdirSync(join(dir,'repo'));
  const target=join(dir,'candidate.json');writeSecretFile(target,'synthetic-only',join(dir,'repo'));
  assert.equal(statSync(target).mode&0o777,0o600);assert.equal(readFileSync(target,'utf8'),'synthetic-only');
  assert.throws(()=>writeSecretFile(target,'overwrite',join(dir,'repo')));
  const link=join(dir,'link');symlinkSync(target,link);assert.throws(()=>writeSecretFile(link,'overwrite',join(dir,'repo')));
  assert.throws(()=>writeSecretFile(join(dir,'repo','secret'),'denied',join(dir,'repo')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
