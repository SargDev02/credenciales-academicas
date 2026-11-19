import { defineConfig } from "@playwright/test";
import { chromiumLaunchOptions } from "./tests/helpers/browser.mjs";
export default defineConfig({
  testDir: "./tests/frontend", testMatch: "academic-review.spec.mjs", fullyParallel: false,
  workers: 1, retries: 0, timeout: 60000, reporter: "list",
  use: { headless: true, viewport: { width: 1440, height: 1000 }, launchOptions: chromiumLaunchOptions, trace: "off", video: "off", screenshot: "off" },
});
