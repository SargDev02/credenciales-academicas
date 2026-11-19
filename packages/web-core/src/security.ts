// HTTP controls only: no product authorization or database access.
export function securityHeaders(production: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}
export function webContentSecurityPolicy(nonce: string, development: boolean) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React/Next components use style attributes. Script execution never uses
    // unsafe-inline; this allowance is limited to presentation.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
}

export type RequestLimit = { bucket: string; limit: number; windowMs: number };
export function apiRequestLimit(path: string, method: string): RequestLimit {
  if (path.startsWith("/api/v1/public/shares/")) return { bucket: "public-shares", limit: 120, windowMs: 60_000 };
  if (path === "/api/v1/identity-verifications" && method === "POST") return { bucket: "ocr", limit: 6, windowMs: 60_000 };
  if (path.startsWith("/api/v1/admin/") && method === "POST") return { bucket: "provisioning", limit: 20, windowMs: 60_000 };
  if (path.startsWith("/api/v1/health")) return { bucket: "health", limit: 120, windowMs: 60_000 };
  return { bucket: "api", limit: 600, windowMs: 60_000 };
}
// A bounded, process-local admission control. Not a distributed limiter. It
// deliberately ignores user-supplied IP/Authorization headers as bucket keys.
export class LocalRequestLimiter {
  private readonly buckets = new Map<string, { count: number; resetsAt: number }>();
  constructor(private readonly capacity = 16) {}
  consume(policy: RequestLimit, now = Date.now()): { allowed: boolean; retryAfter: number } {
    for (const [key, value] of this.buckets) if (value.resetsAt <= now) this.buckets.delete(key);
    let entry = this.buckets.get(policy.bucket);
    if (!entry) {
      if (this.buckets.size >= this.capacity) return { allowed: false, retryAfter: 60 };
      entry = { count: 0, resetsAt: now + policy.windowMs };
      this.buckets.set(policy.bucket, entry);
    }
    const retryAfter = Math.max(1, Math.ceil((entry.resetsAt - now) / 1000));
    if (entry.count >= policy.limit) return { allowed: false, retryAfter };
    entry.count++;
    return { allowed: true, retryAfter: 0 };
  }
}
