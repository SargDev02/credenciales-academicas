import type { RaesClient } from "./raes-client";
import type { InstitutionalSnapshot } from "./source";
import { buildAcademicObservations } from "./academic-review";

export type DetectionSummary = {
  studentsObserved: number; credentialsObserved: number; proposalsCreated: number; observationsUnchanged: number;
  canonicalWrites: 0;
};
export async function detect(snapshot: InstitutionalSnapshot, raes: RaesClient, detectionId: string, credentialCode: string | null = null): Promise<DetectionSummary> {
  // Validate the complete selected source before submitting any proposal.
  const observations = buildAcademicObservations(snapshot, credentialCode);
  const summary: DetectionSummary = { studentsObserved: observations.length, credentialsObserved: 0, proposalsCreated: 0, observationsUnchanged: 0, canonicalWrites: 0 };
  for (const observation of observations) {
    const result = await raes.submitReview(detectionId, observation);
    summary.credentialsObserved += observation.credenciales.length;
    summary.proposalsCreated += result.observaciones.filter(v => v.nueva).length;
    summary.observationsUnchanged += result.observaciones.filter(v => !v.nueva).length;
  }
  return summary;
}
