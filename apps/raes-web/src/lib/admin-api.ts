import "server-only";
import { cache } from "react";
import { apiRequest } from "@raes/web-core";
import { requireSession } from "./auth";
import { getWebConfig } from "./env";
import { isInstitutions, isClients, isAdminProfile } from "./admin-model";
export const getInstitutions = cache(async () => {
  const { token } = await requireSession();
  return (
    await apiRequest(getWebConfig().apiBase, "/api/v1/admin/institutions", {
      token,
      validate: isInstitutions,
    })
  ).data;
});
export const getApiClients = cache(async () => {
  const { token } = await requireSession();
  return (
    await apiRequest(getWebConfig().apiBase, "/api/v1/admin/api-clients", {
      token,
      validate: isClients,
    })
  ).data;
});

export const getAdminProfile = cache(async () => {
  const { token } = await requireSession();
  return (await apiRequest(getWebConfig().apiBase, "/api/v1/admin/me", {
    token, validate: isAdminProfile,
  })).data;
});
