import "server-only";
import { cache } from "react";
import { apiRequest } from "@raes/web-core";
import { requireSession } from "./auth";
import { getWebConfig } from "./env";
import {
  isProfile,
  isVerification,
  isLink,
  isCredentials,
} from "./citizen-model";
export async function citizenRequest<T>(
  path: string,
  validate: (v: unknown) => v is T,
  options: {
    method?: "POST" | "PUT" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
  } = {},
) {
  const { token } = await requireSession();
  return apiRequest(getWebConfig().apiBase, path, {
    token,
    validate,
    ...options,
  });
}
export const getProfile = cache(
  async () => (await citizenRequest("/api/v1/profile", isProfile)).data,
);
export const getVerification = cache(
  async () =>
    (await citizenRequest("/api/v1/identity-verifications", isVerification))
      .data,
);
export const getRaesLink = cache(
  async () => (await citizenRequest("/api/v1/raes/link", isLink)).data,
);
export const getCredentials = cache(
  async () => (await citizenRequest("/api/v1/credentials", isCredentials)).data,
);
