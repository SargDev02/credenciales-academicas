import {verifyCompletedReview} from './lib/academic-review-completed.mjs';
import {safeDiagnostic} from './lib/academic-review-idempotence.mjs';
if (process.argv.includes("--local")) {
  if (process.argv.slice(2).join(" ") !== "--local") throw new Error("Use --local alone for isolated postcheck");
  const { verifyLocalCompletedReview } = await import("./lib/academic-review-local.mjs");
  console.log(JSON.stringify(await verifyLocalCompletedReview()));
} else {
const outputPath=`/tmp/academic-review-postcheck-${Date.now()}-${process.pid}.json`;
try{const result=await verifyCompletedReview({outputPath});console.log(JSON.stringify({...result,outputPath}));}
catch(error){console.error(JSON.stringify({result:'FAIL',diagnostic:error.operatorDiagnostic??safeDiagnostic(error,'POSTCHECK'),outputPath}));process.exitCode=1;}

}
