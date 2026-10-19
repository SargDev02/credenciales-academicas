import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/test-results/**",
    "**/playwright-report/**",
    "**/next-env.d.ts",
  ]),
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: [
          "apps/*/tsconfig.json",
          "services/*/tsconfig.json",
          "packages/*/tsconfig.json",
          "tsconfig.tools.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // node:test owns completion/rejections of registered tests; other promises
      // (including assertions and application code inside tests) remain checked.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "@types/node", name: "test" },
          ],
        },
      ],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  ...nextVitals.map((config) => ({
    ...config,
    files: ["apps/**/*.{ts,tsx}", "services/*-api/**/*.{ts,tsx}"],
    settings: {
      ...config.settings,
      next: {
        rootDir: [
          "apps/raes-web",
          "apps/credenly-web",
          "services/raes-api",
          "services/credenly-api",
        ],
      },
    },
  })),
);
