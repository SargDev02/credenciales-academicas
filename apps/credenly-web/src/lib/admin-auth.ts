import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { apiRequest } from "@raes/web-core";
import { createScopedWebAuth } from "./auth";
import { getWebConfig } from "./env";
import { adminCookieName, isAdminProfile } from "./admin-model";
export const requireAdminSession = cache(async () => {
  const auth = await createScopedWebAuth(adminCookieName);
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) redirect("/admin/login");
  const { data: { session } } = await auth.auth.getSession();
  if (!session) redirect("/admin/login");
  const profile = await apiRequest(getWebConfig().apiBase, "/api/v1/admin/me", { token: session.access_token, validate: isAdminProfile });
  return { token: session.access_token, profile: profile.data };
});
