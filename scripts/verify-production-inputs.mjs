import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {findSecretKinds} from './scan-repository-secrets.mjs';
export const externalActions=['domainsAndHosting','trustedIngress','hostedAuthAndMail','passwordRecoveryDeliveryAndRevocation','leakedPasswordProtection','identityExposurePolicy','retentionPolicy','secretsCustodyAndRotation','backupRestoreAndRpoRto','monitoringAlerts','institutionalConnectors','versionedMigrationsApproval'];
export function verifyProductionInputs(input,release,now=Date.now()){
 const blocked=[];
 if(!input||typeof input!=='object'||input.version!==1)return {status:'BLOCKED',blocked:['invalid-input-manifest']};
 if(input.scope!=='closed-synthetic-pilot')blocked.push('exposure-scope-not-approved');
 if(Object.keys(input).some(key=>!['version','release','verifiedAt','rpoSeconds','rtoSeconds','scope','actions'].includes(key)))blocked.push('unexpected-input-fields');
 if(input.release!==release)blocked.push('release-mismatch');
 const timestamp=Date.parse(input.verifiedAt);
 if(!Number.isFinite(timestamp)||timestamp>now+300000||timestamp<now-86400000)blocked.push('external-evidence-stale-or-missing');
 for(const key of externalActions){const row=input.actions?.[key];if(row?.verified!==true||typeof row.evidenceReference!=='string'||!row.evidenceReference.trim()||row.evidenceReference.includes('OWNER_REQUIRED'))blocked.push(key);}
 if(!Number.isInteger(input.rpoSeconds)||input.rpoSeconds<1||!Number.isInteger(input.rtoSeconds)||input.rtoSeconds<1)blocked.push('rpo-rto-decision');
 if(findSecretKinds(JSON.stringify(input)).length)blocked.push('secret-values-forbidden');
 return {status:blocked.length?'BLOCKED':'OWNER_ATTESTED',blocked,remoteStateIndependentlyVerified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const release=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();const result=verifyProductionInputs(JSON.parse(readFileSync(process.argv[2],'utf8')),release);console.log(JSON.stringify(result));if(result.status==='BLOCKED')process.exitCode=1;}catch{console.error(JSON.stringify({status:'BLOCKED',blocked:['input-manifest-unavailable']}));process.exitCode=1;}
}
