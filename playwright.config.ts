import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/frontend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: {
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    reducedMotion: "reduce",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    ...[360, 768, 1024, 1440].map((width) => ({
      testIgnore: ["admin.spec.ts", "academic-review.spec.mjs"],
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
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter @credenly/web exec next start -p 3203",
      url: "http://localhost:3203",
      reuseExistingServer: true,
    },
  ],
});
