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
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @credenly/web exec next start -p 3203",
      url: "http://localhost:3203",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
