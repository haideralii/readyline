import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // REQ-002 FR-4 / AC-5: app code logs through @/lib/logging, never console.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-console": "error" },
  },
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test output
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
