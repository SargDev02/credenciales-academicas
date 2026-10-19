import "server-only";
import { cache } from "react";
import { apiRequest } from "@raes/web-core";
import { requireAdminSession } from "./admin-auth";
import { getWebConfig } from "./env";
import { isOverview, isHealth, isAuthAccounts } from "./admin-model";
export const getOverview = cache(async () => {
  const { token } = await requireAdminSession();
  return (await apiRequest(getWebConfig().apiBase, "/api/v1/admin/overview", { token, validate: isOverview })).data;
});
export const getAdminHealth = cache(async () => {
  const { token } = await requireAdminSession();
  return (await apiRequest(getWebConfig().apiBase, "/api/v1/admin/health", { token, validate: isHealth, timeoutMs: 15000 })).data;
});
export async function getAdminAccounts(page: string) {
  const { token } = await requireAdminSession();
  return (await apiRequest(getWebConfig().apiBase, "/api/v1/admin/users", { token, validate: isAuthAccounts, query: { page } })).data;
}
