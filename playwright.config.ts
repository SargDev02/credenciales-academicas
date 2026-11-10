import { defineConfig } from "@playwright/test";
import { chromiumLaunchOptions } from "./tests/helpers/browser.mjs";
export default defineConfig({
  testDir: "./tests/frontend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: chromiumLaunchOptions,
    reducedMotion: "reduce",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    ...[360, 768, 1024, 1440].map((width) => ({
      testIgnore: "admin.spec.ts",
      name: `width-${width}`,
      use: { viewport: { width, height: 1000 } },
    })),
    {
      name: "credenly-admin",
      testMatch: "admin.spec.ts",
      timeout: 60000,
      use: { viewport: { width: 1440, height: 1000 }, screenshot: "off" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @raes/web exec next start -p 3200",
      url: "http://localhost:3200/login",
      // Public pages need valid configuration but never a remote account.
      env: {
        RAES_WEB_SUPABASE_URL: "https://localhost:9",
        RAES_WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture_only",
        RAES_API_BASE_URL: "http://localhost:9",
      },
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @credenly/web exec next start -p 3203",
      url: "http://localhost:3203",
      env: {
        CREDENLY_WEB_SUPABASE_URL: "https://localhost:9",
        CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture_only",
        CREDENLY_API_BASE_URL: "http://localhost:9",
      },
      reuseExistingServer: false,
    },
  ],
});
