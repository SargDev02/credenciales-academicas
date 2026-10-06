import {
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const SHARE_TOKEN_PREFIX = "crdn_shr_";

export function generateShareToken(): string {
  return `${SHARE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getShareTokenPrefix(token: string): string {
  return token.slice(0, 20);
}

export function isValidShareTokenFormat(token: string): boolean {
  return /^crdn_shr_[A-Za-z0-9_-]{40,50}$/.test(token);
}

export function hashAccessIp(
  ip: string | null,
  secretMaterial: string,
): string | null {
  if (!ip) {
    return null;
  }

  const derivedKey = createHash("sha256")
    .update(`credenly-access-log-v1:${secretMaterial}`)
    .digest();

  return createHmac("sha256", derivedKey)
    .update(ip)
    .digest("hex");
}
