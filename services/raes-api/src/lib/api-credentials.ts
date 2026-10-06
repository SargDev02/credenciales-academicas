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
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  const separatorIndex = token.indexOf(".");

  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null;
  }

  const clientId = token.slice(0, separatorIndex);
  const secret = token.slice(separatorIndex + 1);

  if (
    !clientId.startsWith(CLIENT_ID_PREFIX) ||
    !secret.startsWith(SECRET_PREFIX)
  ) {
    return null;
  }

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
