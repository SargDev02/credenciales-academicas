import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function verifyBackupBundle(manifestPath){
 const base=realpathSync(dirname(resolve(manifestPath))),value=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(value.version!==1||!['RAES','CREDENLY'].includes(value.product)||!Array.isArray(value.files))throw Error('INVALID_BACKUP_MANIFEST');
 const kinds=new Set();
 for(const file of value.files){
  if(!['database','auth','configuration','external-secret-references'].includes(file.kind)||kinds.has(file.kind)||typeof file.path!=='string'||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('INVALID_BACKUP_ENTRY');
  const target=realpathSync(resolve(base,file.path)),rel=relative(base,target);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('BACKUP_OUTSIDE_BUNDLE');
  const hash=createHash('sha256');for await(const bytes of createReadStream(target))hash.update(bytes);
  if(hash.digest('hex')!==file.sha256)throw Error('BACKUP_INTEGRITY_FAILED');
  kinds.add(file.kind);
 }
 if(kinds.size!==4)throw Error('INCOMPLETE_BACKUP_BUNDLE');
 return {result:'PASS',product:value.product,components:4,authenticationOfOriginProven:false,restoreProven:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await verifyBackupBundle(process.argv[2])));}catch{console.error(JSON.stringify({result:'FAIL',code:'BACKUP_BUNDLE_INVALID'}));process.exitCode=1;}
}
