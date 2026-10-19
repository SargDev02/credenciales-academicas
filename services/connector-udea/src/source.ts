import { createInstitutionSourceClient as createSource } from "@raes/connector-core";
import type { ConnectorEnv } from "./env";
export { readInstitutionalSnapshot, type InstitutionRow, type CampusRow, type ProgramRow, type ProgramCampusRow, type StudentRow, type EnrollmentRow, type CredentialRow, type InstitutionalSnapshot } from "@raes/connector-core";
export function createInstitutionSourceClient(env: ConnectorEnv) {
  return createSource({ supabaseUrl: env.UDEA_SUPABASE_URL, serviceRoleKey: env.UDEA_SUPABASE_SERVICE_ROLE_KEY });
}
