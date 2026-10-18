import { stableKey as coreKey } from "@raes/connector-core";
export { requestId } from "@raes/connector-core";
export function stableKey(operation: string, sourceId: string, payload?: unknown): string {
  return coreKey("poli", operation, sourceId, payload);
}
