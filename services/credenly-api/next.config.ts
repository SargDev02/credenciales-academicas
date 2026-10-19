import { securityHeaders } from "@raes/web-core/security";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Share tokens / Auth callback codes can be present in URLs. Keep incoming
  // paths and Server Action invocations out of Next's development console.
  logging: { incomingRequests: false, serverFunctions: false, browserToTerminal: false },
  transpilePackages: ["@raes/web-core"],
  async headers() {
    return [{ source: "/api/:path*", headers: [
      ...securityHeaders(process.env.NODE_ENV === "production"),
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
    ] }];
  },
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
