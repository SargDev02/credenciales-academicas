import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CLIENT_ID_PREFIX = "raes_cli_";
const SECRET_PREFIX = "raes_sk_";
const SECRET_LOOKUP_PREFIX_LENGTH = 20;

export type ParsedBearerCredentials = {
  clientId: string;
  secret: string;
};

export function generateClientId(): string {
  return `${CLIENT_ID_PREFIX}${randomBytes(18).toString("base64url")}`;
}

export function generateClientSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function getSecretLookupPrefix(secret: string): string {
  return secret.slice(0, SECRET_LOOKUP_PREFIX_LENGTH);
}

export function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifyClientSecret(
  receivedSecret: string,
  storedHash: string,
): boolean {
  const receivedHash = hashClientSecret(receivedSecret);

  if (
    receivedHash.length !== storedHash.length ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(receivedHash, "hex"),
    Buffer.from(storedHash, "hex"),
  );
}

export function parseApiBearer(
  authorizationHeader: string | null,
): ParsedBearerCredentials | null {
  const match = authorizationHeader?.trim().match(/^Bearer[ \t]+(raes_cli_[A-Za-z0-9_-]+)\.(raes_sk_[A-Za-z0-9_-]+)$/i);
  const clientId = match?.[1];
  const secret = match?.[2];
  if (!clientId || !secret || clientId.length > 120 || secret.length > 256) return null;

  return { clientId, secret };
}

export function formatApiBearer(
  clientId: string,
  secret: string,
): string {
  return `Bearer ${clientId}.${secret}`;
}

export const parseInstitutionBearer = parseApiBearer;
export const formatInstitutionBearer = formatApiBearer;
