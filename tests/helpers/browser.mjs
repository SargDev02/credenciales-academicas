import { existsSync } from "node:fs";

export function chromiumOptions(
  platform = process.platform,
  override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  exists = existsSync,
) {
  if (override) return { headless: true, executablePath: override };
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  // Linux CI uses the Chromium version installed by the pinned Playwright CLI.
  return platform === "darwin" && exists(chrome)
    ? { headless: true, executablePath: chrome }
    : { headless: true };
}
export const chromiumLaunchOptions = chromiumOptions();
