import { securityHeaders } from "@raes/web-core/security";
import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: (process.env.CREDENLY_WEB_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  transpilePackages: ["@raes/ui", "@raes/web-core"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
};
export default config;
