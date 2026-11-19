import { RaesClient, type RaesConnectorConfig } from "./raes-client";
import { createInstitutionSourceClient, readInstitutionalSnapshot, type SourceConfig } from "./source";
import { parseDetectionArgs } from "./academic-review";
import { detect } from "./sync";

export async function runDetection(sourceConfig: SourceConfig, apiConfig: RaesConnectorConfig, args: string[]): Promise<void> {
  const options = parseDetectionArgs(args), raes = new RaesClient(apiConfig);
  const lease = await raes.startDetection();
  let failed = true;
  try {
    const snapshot = await readInstitutionalSnapshot(createInstitutionSourceClient(sourceConfig));
    const summary = await detect(snapshot, raes, lease.id, options.credentialCode);
    console.log(JSON.stringify({ operation: "DETECT_AND_SUBMIT", ...summary }));
    failed = false;
  } finally {
    // A fenced release can only affect this invocation, never a newer detector.
    await raes.finishDetection(lease.id, failed);
  }
}
