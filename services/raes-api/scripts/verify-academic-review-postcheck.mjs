import {verifyCompletedReview} from './lib/academic-review-completed.mjs';
import {safeDiagnostic} from './lib/academic-review-idempotence.mjs';
const outputPath=`/tmp/academic-review-postcheck-${Date.now()}-${process.pid}.json`;
try{const result=await verifyCompletedReview({outputPath});console.log(JSON.stringify({...result,outputPath}));}
catch(error){console.error(JSON.stringify({result:'FAIL',diagnostic:error.operatorDiagnostic??safeDiagnostic(error,'POSTCHECK'),outputPath}));process.exitCode=1;}
