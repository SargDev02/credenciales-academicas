export function requestId(value?: string | null): string {
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : crypto.randomUUID();
}
export type OperationalEvent = "REQUEST_ADMITTED" | "RATE_LIMITED" | "LIMIT_UNAVAILABLE" | "UNHANDLED_ERROR" | "DEPENDENCY_DOWN" | "CONNECTOR_STARTED" | "CONNECTOR_COMPLETED" | "CONNECTOR_FAILED" | "CONNECTOR_RELEASE_FAILED" | "ACADEMIC_DECISION_FAILED" | "ACADEMIC_DECISION_SUCCEEDED" | "RECOVERY_DELIVERY_FAILED";
export function operationalRecord(service: string, event: OperationalEvent, details: Record<string,unknown> = {}) {
  const events=["REQUEST_ADMITTED","RATE_LIMITED","LIMIT_UNAVAILABLE","UNHANDLED_ERROR","DEPENDENCY_DOWN","CONNECTOR_STARTED","CONNECTOR_COMPLETED","CONNECTOR_FAILED","CONNECTOR_RELEASE_FAILED","ACADEMIC_DECISION_FAILED","ACADEMIC_DECISION_SUCCEEDED","RECOVERY_DELIVERY_FAILED"];
  const services=["raes-api","credenly-api","raes-web","credenly-web","connector","connector-poli","connector-udea","test-web"];
  const record: Record<string,unknown> = { timestamp: new Date().toISOString(), service: services.includes(service) ? service : "application", event:events.includes(event)?event:"UNHANDLED_ERROR" };
  if (typeof details.requestId === "string") record.requestId = requestId(details.requestId);
  for (const field of ["status", "durationMs", "canonicalWrites", "proposalsCreated", "retryAfter"]) {
    if (typeof details[field] === "number" && Number.isFinite(details[field]) && details[field] >= 0) record[field] = details[field];
  }
  return record;
}
export function operationalLog(service: string, event: OperationalEvent, details: Record<string,unknown> = {}) {
  console.log(JSON.stringify(operationalRecord(service,event,details)));
}
