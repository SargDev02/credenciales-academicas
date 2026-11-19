import { reconstructSchema, readProjectFile } from "./schema-fixture.mjs";
export const read = readProjectFile;
export const reviewMigration = "supabase/raes/migrations/20261109161812_academic_review.sql";
// One reconstruction chain: archived DDL -> hardening #16 -> academic review #17.
export function createReviewDb({ beforeReview } = {}) {
  return reconstructSchema("raes", { stage: "current", beforeAcademicReview: beforeReview });
}
