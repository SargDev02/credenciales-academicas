import { createHash, randomUUID } from "node:crypto";

export function requestId(): string {
  return randomUUID();
}

export function stableKey(
  operation: string,
  sourceId: string,
  payload?: unknown,
): string {
  const base = `poli:${operation}:${sourceId}`;

  if (payload === undefined) {
    return base.slice(0, 200);
  }

  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);

  return `${base}:${digest}`.slice(0, 200);
}
